import csv
from datetime import date, timedelta
import io
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
from app.models.sales import MilkProduction
from app.schemas.reports import DashboardOverviewResponse, ProfitabilityReport
from app.services.report_service import get_dashboard_overview, get_profitability_report

router = APIRouter()


@router.get("/dashboard", response_model=DashboardOverviewResponse)
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    return await get_dashboard_overview(db)


@router.get("/profitability", response_model=ProfitabilityReport)
async def get_period_profitability(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    today = date.today()
    if not end_date:
        end_date = today
    if not start_date:
        start_date = today.replace(day=1)

    return await get_profitability_report(db, start_date, end_date)


@router.get("/profitability/csv")
async def export_profitability_csv(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    today = date.today()
    if not end_date:
        end_date = today
    if not start_date:
        start_date = today.replace(day=1)

    report = await get_profitability_report(db, start_date, end_date)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Cow Farm Management System - Period Profitability Report"])
    writer.writerow(["Period", f"{report.start_date} to {report.end_date}"])
    writer.writerow([])
    writer.writerow(["REVENUE ITEM", "AMOUNT (BDT)"])
    writer.writerow(["Milk Sales Revenue", f"{report.milk_revenue:.2f}"])
    writer.writerow(["Animal / Cow Sales Revenue", f"{report.cow_sales_revenue:.2f}"])
    writer.writerow(["Other Invoiced Revenue", f"{report.other_sales_revenue:.2f}"])
    writer.writerow(["Total Invoiced Revenue", f"{report.total_invoiced_revenue:.2f}"])
    writer.writerow(["Cash Collected in Period", f"{report.cash_collected:.2f}"])
    writer.writerow(["Uncollected Receivables", f"{report.receivables_uncollected:.2f}"])
    writer.writerow([])
    writer.writerow(["COST ITEM", "AMOUNT (BDT)"])
    writer.writerow(["Cow Acquisition Cost", f"{report.cow_acquisition_cost:.2f}"])
    writer.writerow(["Feed Consumption Cost", f"{report.feed_consumption_cost:.2f}"])
    writer.writerow(["General Non-Animal Expenses", f"{report.general_expenses:.2f}"])
    writer.writerow(["Health & Breeding Cost", f"{report.health_and_breeding_cost:.2f}"])
    writer.writerow(["Labor Salary Paid", f"{report.labor_salary_paid:.2f}"])
    writer.writerow(["Mill Charges", f"{report.mill_charges:.2f}"])
    writer.writerow(["Total Operational Costs", f"{report.total_costs:.2f}"])
    writer.writerow([])
    writer.writerow(["PROFITABILITY SUMMARY", "AMOUNT (BDT)"])
    writer.writerow(["Accrual Net Profit", f"{report.accrual_net_profit:.2f}"])
    writer.writerow(["Cash Net Margin", f"{report.cash_net_margin:.2f}"])
    writer.writerow(["Profit Margin %", f"{report.profit_margin_percent:.2f}%"])

    content = output.getvalue()
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=profitability_{start_date}_{end_date}.csv"
        },
    )


@router.get("/herd-summary/csv")
async def export_herd_summary_csv(
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    dashboard = await get_dashboard_overview(db)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Cow Farm Management System - Herd Summary Snapshot"])
    writer.writerow(["As of", str(date.today())])
    writer.writerow([])
    writer.writerow(["METRIC", "COUNT"])
    writer.writerow(["Total Cows", dashboard.total_cows])
    writer.writerow(["Active Cows", dashboard.active_cows])
    writer.writerow(["Sold Cows", dashboard.sold_cows])
    writer.writerow(["Deceased Cows", dashboard.deceased_cows])
    writer.writerow([])
    writer.writerow(["CATEGORY", "ACTIVE COUNT"])
    for cat, count in sorted(dashboard.cows_by_category.items()):
        writer.writerow([cat, count])
    writer.writerow([])
    writer.writerow(["SHED", "ACTIVE COUNT"])
    for shed, count in sorted(dashboard.cows_by_warehouse.items()):
        writer.writerow([shed, count])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=herd_summary_{date.today()}.csv"
        },
    )


@router.get("/milk-summary/csv")
async def export_milk_summary_csv(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    today = date.today()
    if not end_date:
        end_date = today
    if not start_date:
        start_date = today.replace(day=1)

    stmt = (
        select(MilkProduction)
        .options(selectinload(MilkProduction.cow))
        .where(
            MilkProduction.production_date >= start_date,
            MilkProduction.production_date <= end_date,
            MilkProduction.is_archived == False,
            MilkProduction.is_void == False,
        )
        .order_by(MilkProduction.production_date.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    by_cow: dict[str, float] = {}
    total_liters = 0.0
    for r in rows:
        tag = r.cow.current_tag_number if r.cow else str(r.cow_id)
        liters = float(r.liters or 0)
        total_liters += liters
        by_cow[tag] = by_cow.get(tag, 0.0) + liters

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Cow Farm Management System - Milk Production Summary"])
    writer.writerow(["Period", f"{start_date} to {end_date}"])
    writer.writerow(["Total Production (L)", f"{total_liters:.2f}"])
    writer.writerow(["Session Records", len(rows)])
    writer.writerow([])
    writer.writerow(["COW TAG", "TOTAL LITERS (L)"])
    for tag, liters in sorted(by_cow.items(), key=lambda kv: kv[1], reverse=True):
        writer.writerow([tag, f"{liters:.2f}"])
    writer.writerow([])
    writer.writerow(["DATE", "COW TAG", "SESSION", "LITERS (L)"])
    for r in rows:
        writer.writerow([
            str(r.production_date),
            r.cow.current_tag_number if r.cow else str(r.cow_id),
            r.session,
            f"{float(r.liters or 0):.2f}",
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=milk_summary_{start_date}_{end_date}.csv"
        },
    )
