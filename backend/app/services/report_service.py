from datetime import date, timedelta
from decimal import Decimal
from typing import List
import uuid
from sqlalchemy import func, literal, select, union_all
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

    # 1. Consolidated scalar metrics in a single round-trip query
    scalars_stmt = select(
        # Cow stats
        select(func.count(Cow.cow_id))
        .where(Cow.is_archived == False)
        .scalar_subquery()
        .label("total_cows"),
        select(func.count(Cow.cow_id))
        .where(Cow.is_archived == False, Cow.status == "active")
        .scalar_subquery()
        .label("active_cows"),
        select(func.count(Cow.cow_id))
        .where(Cow.is_archived == False, Cow.status == "sold")
        .scalar_subquery()
        .label("sold_cows"),
        select(func.count(Cow.cow_id))
        .where(Cow.is_archived == False, Cow.status == "deceased")
        .scalar_subquery()
        .label("deceased_cows"),
        # Milk stats
        select(func.coalesce(func.sum(MilkProduction.liters), 0))
        .where(MilkProduction.production_date == today)
        .scalar_subquery()
        .label("milk_today"),
        select(func.coalesce(func.sum(MilkProduction.liters), 0))
        .where(MilkProduction.production_date >= week_ago)
        .scalar_subquery()
        .label("milk_week"),
        select(func.coalesce(func.sum(MilkProduction.liters), 0))
        .where(MilkProduction.production_date >= month_start)
        .scalar_subquery()
        .label("milk_month"),
        # Monthly Financials
        select(func.coalesce(func.sum(SalesInvoice.total_amount), 0))
        .where(
            SalesInvoice.invoice_date >= month_start,
            SalesInvoice.status.in_(["issued", "partially_paid", "paid"]),
        )
        .scalar_subquery()
        .label("month_inv"),
        select(func.coalesce(func.sum(SalePayment.amount), 0))
        .where(SalePayment.payment_date >= month_start)
        .scalar_subquery()
        .label("month_cash"),
        select(
            func.coalesce(
                func.sum(SalesInvoice.total_amount - SalesInvoice.paid_amount), 0
            )
        )
        .where(SalesInvoice.status.in_(["issued", "partially_paid"]))
        .scalar_subquery()
        .label("total_receivables"),
        # Monthly Expenses
        select(func.coalesce(func.sum(FeedingRecord.cost), 0))
        .where(FeedingRecord.feeding_date >= month_start)
        .scalar_subquery()
        .label("feed_exp"),
        select(func.coalesce(func.sum(Expense.amount), 0))
        .where(Expense.expense_date >= month_start)
        .scalar_subquery()
        .label("gen_exp"),
        select(func.coalesce(func.sum(HealthRecord.cost), 0))
        .where(HealthRecord.record_date >= month_start)
        .scalar_subquery()
        .label("health_exp"),
        select(func.coalesce(func.sum(SalaryPayment.net_paid), 0))
        .where(SalaryPayment.paid_date >= month_start)
        .scalar_subquery()
        .label("salary_exp"),
        select(func.coalesce(func.sum(MillCharge.amount), 0))
        .where(MillCharge.charge_date >= month_start)
        .scalar_subquery()
        .label("mill_exp"),
    )
    scalars = (await session.execute(scalars_stmt)).first()

    total_cows = scalars.total_cows or 0
    active_cows = scalars.active_cows or 0
    sold_cows = scalars.sold_cows or 0
    deceased_cows = scalars.deceased_cows or 0
    milk_today = Decimal(str(scalars.milk_today or 0))
    milk_week = Decimal(str(scalars.milk_week or 0))
    milk_month = Decimal(str(scalars.milk_month or 0))
    month_inv = Decimal(str(scalars.month_inv or 0))
    month_cash = Decimal(str(scalars.month_cash or 0))
    total_receivables = Decimal(str(scalars.total_receivables or 0))
    feed_exp = Decimal(str(scalars.feed_exp or 0))
    gen_exp = Decimal(str(scalars.gen_exp or 0))
    health_exp = Decimal(str(scalars.health_exp or 0))
    salary_exp = Decimal(str(scalars.salary_exp or 0))
    mill_exp = Decimal(str(scalars.mill_exp or 0))
    month_expenses = feed_exp + gen_exp + health_exp + salary_exp + mill_exp

    # 2. Active cow breakdown by category and warehouse in a single query
    active_cows_stmt = (
        select(Cow.category, Warehouse.name)
        .outerjoin(Warehouse, Cow.warehouse_id == Warehouse.warehouse_id)
        .where(Cow.is_archived == False, Cow.status == "active")
    )
    active_rows = (await session.execute(active_cows_stmt)).all()
    cows_by_category = {}
    cows_by_warehouse = {}
    for cat, wh_name in active_rows:
        if cat:
            cows_by_category[cat] = cows_by_category.get(cat, 0) + 1
        if wh_name:
            cows_by_warehouse[wh_name] = cows_by_warehouse.get(wh_name, 0) + 1

    # 3. Action Alerts
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

    # 2. All costs and cash collected in date range in a single scalar subquery round trip
    costs_stmt = select(
        select(func.coalesce(func.sum(SalePayment.amount), 0))
        .where(
            SalePayment.payment_date >= start_date,
            SalePayment.payment_date <= end_date,
        )
        .scalar_subquery()
        .label("cash_collected"),
        select(func.coalesce(func.sum(Cow.purchase_price), 0))
        .where(
            Cow.acquisition_date >= start_date,
            Cow.acquisition_date <= end_date,
        )
        .scalar_subquery()
        .label("cow_acq"),
        select(func.coalesce(func.sum(FeedingRecord.cost), 0))
        .where(
            FeedingRecord.feeding_date >= start_date,
            FeedingRecord.feeding_date <= end_date,
        )
        .scalar_subquery()
        .label("feed_cost"),
        select(func.coalesce(func.sum(Expense.amount), 0))
        .where(
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
        )
        .scalar_subquery()
        .label("gen_exp"),
        select(func.coalesce(func.sum(HealthRecord.cost), 0))
        .where(
            HealthRecord.record_date >= start_date,
            HealthRecord.record_date <= end_date,
        )
        .scalar_subquery()
        .label("health_cost"),
        select(func.coalesce(func.sum(BreedingRecord.cost), 0))
        .where(
            BreedingRecord.seed_date >= start_date,
            BreedingRecord.seed_date <= end_date,
        )
        .scalar_subquery()
        .label("breeding_cost"),
        select(func.coalesce(func.sum(SalaryPayment.net_paid), 0))
        .where(
            SalaryPayment.paid_date >= start_date,
            SalaryPayment.paid_date <= end_date,
            SalaryPayment.status == "paid",
        )
        .scalar_subquery()
        .label("salary_paid"),
        select(func.coalesce(func.sum(MillCharge.amount), 0))
        .where(
            MillCharge.charge_date >= start_date,
            MillCharge.charge_date <= end_date,
        )
        .scalar_subquery()
        .label("mill_cost"),
    )
    costs_row = (await session.execute(costs_stmt)).first()

    cash_collected = Decimal(str(costs_row.cash_collected or 0))
    cow_acq = Decimal(str(costs_row.cow_acq or 0))
    feed_cost = Decimal(str(costs_row.feed_cost or 0))
    gen_exp = Decimal(str(costs_row.gen_exp or 0))
    health_cost = Decimal(str(costs_row.health_cost or 0))
    breeding_cost = Decimal(str(costs_row.breeding_cost or 0))
    health_and_breeding = health_cost + breeding_cost
    salary_paid = Decimal(str(costs_row.salary_paid or 0))
    mill_cost = Decimal(str(costs_row.mill_cost or 0))

    uncollected = max(Decimal("0.00"), total_invoiced - cash_collected)
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
