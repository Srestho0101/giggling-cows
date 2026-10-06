import csv
from datetime import date, timedelta
import io
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import AuthUser, UserRole, get_current_user, require_roles
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
