from datetime import date, timedelta
from decimal import Decimal
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health import BreedingRecord, HealthRecord, PregnancyReport
from app.models.evaluation import PurchaseEvaluation
from app.models.feeding import Expense, FeedingRecord
from app.models.herd import Cow, Warehouse
from app.models.labor import MillCharge, SalaryPayment
from app.models.sales import MilkProduction, SalePayment, SalesInvoice, SalesInvoiceLine
from app.schemas.reports import DashboardAlertItem, DashboardOverviewResponse, ProfitabilityReport


async def get_dashboard_overview(session: AsyncSession) -> DashboardOverviewResponse:
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    month_start = today.replace(day=1)

    # 1. Cow stats
    cows_stmt = select(Cow)
    all_cows = (await session.execute(cows_stmt)).scalars().all()

    total_cows = len(all_cows)
    active_cows = sum(1 for c in all_cows if c.status == "active")
    sold_cows = sum(1 for c in all_cows if c.status == "sold")
    deceased_cows = sum(1 for c in all_cows if c.status == "deceased")

    cows_by_category = {}
    for c in all_cows:
        if c.status == "active":
            cows_by_category[c.category] = cows_by_category.get(c.category, 0) + 1

    # Warehouse occupancy
    warehouses = (await session.execute(select(Warehouse))).scalars().all()
    warehouse_map = {w.warehouse_id: w.name for w in warehouses}
    cows_by_warehouse = {}
    for c in all_cows:
        if c.status == "active" and c.warehouse_id in warehouse_map:
            w_name = warehouse_map[c.warehouse_id]
            cows_by_warehouse[w_name] = cows_by_warehouse.get(w_name, 0) + 1

    # 2. Milk stats
    milk_today_stmt = select(func.coalesce(func.sum(MilkProduction.liters), 0)).where(
        MilkProduction.production_date == today
    )
    milk_today = Decimal(str(await session.scalar(milk_today_stmt) or 0))

    milk_week_stmt = select(func.coalesce(func.sum(MilkProduction.liters), 0)).where(
        MilkProduction.production_date >= week_ago
    )
    milk_week = Decimal(str(await session.scalar(milk_week_stmt) or 0))

    milk_month_stmt = select(func.coalesce(func.sum(MilkProduction.liters), 0)).where(
        MilkProduction.production_date >= month_start
    )
    milk_month = Decimal(str(await session.scalar(milk_month_stmt) or 0))

    # 3. Monthly Financials
    # Invoiced revenue this month
    inv_stmt = select(func.coalesce(func.sum(SalesInvoice.total_amount), 0)).where(
        SalesInvoice.invoice_date >= month_start,
        SalesInvoice.status.in_(["issued", "partially_paid", "paid"]),
    )
    month_inv = Decimal(str(await session.scalar(inv_stmt) or 0))

    # Cash collected this month
    cash_stmt = select(func.coalesce(func.sum(SalePayment.amount), 0)).where(
        SalePayment.payment_date >= month_start
    )
    month_cash = Decimal(str(await session.scalar(cash_stmt) or 0))

    # Total unpaid receivables
    all_unpaid_stmt = select(
        func.coalesce(func.sum(SalesInvoice.total_amount - SalesInvoice.paid_amount), 0)
    ).where(SalesInvoice.status.in_(["issued", "partially_paid"]))
    total_receivables = Decimal(str(await session.scalar(all_unpaid_stmt) or 0))

    # Monthly Expenses (Feed + Expenses + Health/Breeding + Salaries + Mill)
    feed_exp = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(FeedingRecord.cost), 0)).where(
                    FeedingRecord.feeding_date >= month_start
                )
            )
            or 0
        )
    )
    gen_exp = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(Expense.amount), 0)).where(
                    Expense.expense_date >= month_start
                )
            )
            or 0
        )
    )
    health_exp = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(HealthRecord.cost), 0)).where(
                    HealthRecord.record_date >= month_start
                )
            )
            or 0
        )
    )
    salary_exp = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(SalaryPayment.net_paid), 0)).where(
                    SalaryPayment.paid_date >= month_start
                )
            )
            or 0
        )
    )
    mill_exp = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(MillCharge.amount), 0)).where(
                    MillCharge.charge_date >= month_start
                )
            )
            or 0
        )
    )
    month_expenses = feed_exp + gen_exp + health_exp + salary_exp + mill_exp

    # 4. Action Alerts
    alerts: List[DashboardAlertItem] = []

    # Health items due or overdue within next 7 days
    health_alerts_stmt = (
        select(HealthRecord, Cow.current_tag_number)
        .join(Cow, HealthRecord.cow_id == Cow.cow_id)
        .where(
            HealthRecord.next_due_date.is_not(None),
            HealthRecord.next_due_date <= today + timedelta(days=7),
            Cow.status == "active",
        )
        .order_by(HealthRecord.next_due_date.asc())
        .limit(10)
    )
    health_rows = (await session.execute(health_alerts_stmt)).all()
    for hr, tag in health_rows:
        overdue_days = max(0, (today - hr.next_due_date).days)
        alerts.append(
            DashboardAlertItem(
                id=hr.health_id,
                cow_tag=tag,
                item_type=f"{hr.record_type}_due",
                due_date=hr.next_due_date,
                days_overdue=overdue_days,
                description=f"{hr.record_type.capitalize()} scheduled for {tag} ({hr.details or 'Routine'})",
            )
        )

    # Upcoming calvings within next 14 days
    preg_alerts_stmt = (
        select(PregnancyReport, Cow.current_tag_number)
        .join(Cow, PregnancyReport.cow_id == Cow.cow_id)
        .where(
            PregnancyReport.status.in_(["confirmed", "suspected"]),
            PregnancyReport.expected_calving_date.is_not(None),
            PregnancyReport.expected_calving_date <= today + timedelta(days=14),
            Cow.status == "active",
        )
        .order_by(PregnancyReport.expected_calving_date.asc())
        .limit(10)
    )
    preg_rows = (await session.execute(preg_alerts_stmt)).all()
    for pr, tag in preg_rows:
        overdue_days = max(0, (today - pr.expected_calving_date).days)
        alerts.append(
            DashboardAlertItem(
                id=pr.pregnancy_id,
                cow_tag=tag,
                item_type="expected_calving",
                due_date=pr.expected_calving_date,
                days_overdue=overdue_days,
                description=f"Expected Calving for {tag} (Status: {pr.status})",
            )
        )

    return DashboardOverviewResponse(
        total_cows=total_cows,
        active_cows=active_cows,
        sold_cows=sold_cows,
        deceased_cows=deceased_cows,
        cows_by_category=cows_by_category,
        cows_by_warehouse=cows_by_warehouse,
        milk_today_liters=milk_today,
        milk_this_week_liters=milk_week,
        milk_this_month_liters=milk_month,
        month_invoiced_revenue=month_inv,
        month_cash_collected=month_cash,
        month_total_expenses=month_expenses,
        total_unpaid_receivables=total_receivables,
        alerts=alerts,
    )


async def get_profitability_report(
    session: AsyncSession, start_date: date, end_date: date
) -> ProfitabilityReport:
    # 1. Invoiced revenue lines in date range
    lines_stmt = (
        select(SalesInvoiceLine.item_type, func.coalesce(func.sum(SalesInvoiceLine.line_total), 0))
        .join(SalesInvoice, SalesInvoiceLine.invoice_id == SalesInvoice.invoice_id)
        .where(
            SalesInvoice.invoice_date >= start_date,
            SalesInvoice.invoice_date <= end_date,
            SalesInvoice.status.in_(["issued", "partially_paid", "paid"]),
        )
        .group_by(SalesInvoiceLine.item_type)
    )
    line_results = dict((await session.execute(lines_stmt)).all())

    milk_rev = Decimal(str(line_results.get("milk", 0)))
    cow_rev = Decimal(str(line_results.get("animal", 0)))
    other_rev = Decimal(str(line_results.get("other", 0)))
    total_invoiced = milk_rev + cow_rev + other_rev

    # Cash collected in date range
    cash_collected = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(SalePayment.amount), 0)).where(
                    SalePayment.payment_date >= start_date,
                    SalePayment.payment_date <= end_date,
                )
            )
            or 0
        )
    )
    uncollected = max(Decimal("0.00"), total_invoiced - cash_collected)

    # 2. Costs in date range
    # Cow acquisition cost
    cow_acq = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(Cow.purchase_price), 0)).where(
                    Cow.acquisition_date >= start_date,
                    Cow.acquisition_date <= end_date,
                )
            )
            or 0
        )
    )

    # Feed consumption cost
    feed_cost = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(FeedingRecord.cost), 0)).where(
                    FeedingRecord.feeding_date >= start_date,
                    FeedingRecord.feeding_date <= end_date,
                )
            )
            or 0
        )
    )

    # General expenses
    gen_exp = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(Expense.amount), 0)).where(
                    Expense.expense_date >= start_date,
                    Expense.expense_date <= end_date,
                )
            )
            or 0
        )
    )

    # Health & Breeding costs
    health_cost = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(HealthRecord.cost), 0)).where(
                    HealthRecord.record_date >= start_date,
                    HealthRecord.record_date <= end_date,
                )
            )
            or 0
        )
    )
    breeding_cost = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(BreedingRecord.cost), 0)).where(
                    BreedingRecord.seed_date >= start_date,
                    BreedingRecord.seed_date <= end_date,
                )
            )
            or 0
        )
    )
    health_and_breeding = health_cost + breeding_cost

    # Labor salary payments
    salary_paid = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(SalaryPayment.net_paid), 0)).where(
                    SalaryPayment.paid_date >= start_date,
                    SalaryPayment.paid_date <= end_date,
                    SalaryPayment.status == "paid",
                )
            )
            or 0
        )
    )

    # Mill charges
    mill_cost = Decimal(
        str(
            await session.scalar(
                select(func.coalesce(func.sum(MillCharge.amount), 0)).where(
                    MillCharge.charge_date >= start_date,
                    MillCharge.charge_date <= end_date,
                )
            )
            or 0
        )
    )

    total_costs = (
        cow_acq + feed_cost + gen_exp + health_and_breeding + salary_paid + mill_cost
    )

    accrual_net_profit = total_invoiced - total_costs
    cash_net_margin = cash_collected - total_costs
    margin_percent = (
        (accrual_net_profit / total_invoiced * 100).quantize(Decimal("0.01"))
        if total_invoiced > 0
        else Decimal("0.00")
    )

    return ProfitabilityReport(
        start_date=start_date,
        end_date=end_date,
        milk_revenue=milk_rev,
        cow_sales_revenue=cow_rev,
        other_sales_revenue=other_rev,
        total_invoiced_revenue=total_invoiced,
        cash_collected=cash_collected,
        receivables_uncollected=uncollected,
        cow_acquisition_cost=cow_acq,
        feed_consumption_cost=feed_cost,
        general_expenses=gen_exp,
        health_and_breeding_cost=health_and_breeding,
        labor_salary_paid=salary_paid,
        mill_charges=mill_cost,
        total_costs=total_costs,
        accrual_net_profit=accrual_net_profit,
        cash_net_margin=cash_net_margin,
        profit_margin_percent=margin_percent,
    )
