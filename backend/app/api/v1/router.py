from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    cows,
    evaluations,
    feeding,
    health,
    labor,
    reports,
    sales,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Profile"])
api_router.include_router(cows.router, prefix="/herd", tags=["Herd & Farm Structure"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["Purchase Evaluation"])
api_router.include_router(feeding.router, prefix="/feeding", tags=["Feed & Expenses"])
api_router.include_router(labor.router, prefix="/labor", tags=["Workers & Labor"])
api_router.include_router(health.router, prefix="/health", tags=["Health & Breeding"])
api_router.include_router(sales.router, prefix="/sales", tags=["Milk, Customers & Invoices"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports & Dashboards"])
