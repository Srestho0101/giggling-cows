from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional
import uuid
from pydantic import BaseModel


class DashboardAlertItem(BaseModel):
    id: uuid.UUID
    cow_tag: str
    item_type: str  # 'vaccination_due', 'deworming_due', 'expected_calving'
    due_date: date
    days_overdue: int = 0
    description: str


class DashboardOverviewResponse(BaseModel):
    total_cows: int
    active_cows: int
    sold_cows: int
    deceased_cows: int
    cows_by_category: Dict[str, int]
    cows_by_warehouse: Dict[str, int]
    
    milk_today_liters: Decimal
    milk_this_week_liters: Decimal
    milk_this_month_liters: Decimal
    
    month_invoiced_revenue: Decimal
    month_cash_collected: Decimal
    month_total_expenses: Decimal
    total_unpaid_receivables: Decimal
    
    alerts: List[DashboardAlertItem]


class ProfitabilityReport(BaseModel):
    start_date: date
    end_date: date
    
    # Revenue breakdown
    milk_revenue: Decimal
    cow_sales_revenue: Decimal
    other_sales_revenue: Decimal
    total_invoiced_revenue: Decimal
    cash_collected: Decimal
    receivables_uncollected: Decimal
    
    # Cost breakdown
    cow_acquisition_cost: Decimal
    feed_consumption_cost: Decimal
    general_expenses: Decimal
    health_and_breeding_cost: Decimal
    labor_salary_paid: Decimal
    mill_charges: Decimal
    total_costs: Decimal
    
    # Net results
    accrual_net_profit: Decimal
    cash_net_margin: Decimal
    profit_margin_percent: Decimal
