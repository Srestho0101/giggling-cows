from fastapi import APIRouter, Depends
from app.core.security import AuthUser, UserRole, get_current_user

router = APIRouter()


@router.get("/me")
async def get_current_user_profile(
    current_user: AuthUser = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role.value,
        "permissions": {
            "can_manage_users": current_user.role == UserRole.ADMIN,
            "can_view_financial_reports": current_user.role in [UserRole.ADMIN, UserRole.MANAGER],
            "can_record_payments": current_user.role in [UserRole.ADMIN, UserRole.MANAGER],
            "can_edit_operational_data": True,
        },
    }
