import enum
import uuid
from typing import List, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

security_scheme = HTTPBearer(auto_error=False)


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    DATA_ENTRY = "data_entry"


class AuthUser(BaseModel):
    id: uuid.UUID
    email: Optional[str] = None
    role: UserRole
    aud: Optional[str] = None
    app_metadata: dict = {}
    user_metadata: dict = {}


def extract_role_from_payload(payload: dict) -> UserRole:
    # 1. Check user_metadata.role
    user_meta = payload.get("user_metadata", {})
    if isinstance(user_meta, dict) and "role" in user_meta:
        role_str = str(user_meta["role"]).lower()
        if role_str in [r.value for r in UserRole]:
            return UserRole(role_str)

    # 2. Check app_metadata.role
    app_meta = payload.get("app_metadata", {})
    if isinstance(app_meta, dict) and "role" in app_meta:
        role_str = str(app_meta["role"]).lower()
        if role_str in [r.value for r in UserRole]:
            return UserRole(role_str)

    # 3. Check direct role in payload
    role_str = payload.get("role")
    if role_str and str(role_str).lower() in [r.value for r in UserRole]:
        return UserRole(str(role_str).lower())

    # Default role for authenticated users if unspecified
    return UserRole.DATA_ENTRY


def decode_supabase_jwt(token: str) -> dict:
    # In development mode, allow dummy tokens if configured
    if settings.DEBUG and token.startswith("dev-user:"):
        # e.g., "dev-user:admin", "dev-user:manager", "dev-user:data_entry"
        role_part = token.split(":", 1)[1]
        role = UserRole(role_part) if role_part in [r.value for r in UserRole] else UserRole.ADMIN
        return {
            "sub": "00000000-0000-0000-0000-000000000001",
            "email": f"{role.value}@cowfarm.local",
            "role": role.value,
            "user_metadata": {"role": role.value},
        }

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=[settings.SUPABASE_JWT_ALGORITHM],
            options={"verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> AuthUser:
    if not credentials:
        # In debug mode without token, provide a default admin user for ease of local testing
        if settings.DEBUG:
            return AuthUser(
                id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
                email="admin@cowfarm.local",
                role=UserRole.ADMIN,
                user_metadata={"role": "admin"},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_supabase_jwt(credentials.credentials)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user subject",
        )

    try:
        user_id = uuid.UUID(str(user_id_str))
    except ValueError:
        user_id = uuid.uuid5(uuid.NAMESPACE_DNS, str(user_id_str))

    role = extract_role_from_payload(payload)
    return AuthUser(
        id=user_id,
        email=payload.get("email"),
        role=role,
        aud=payload.get("aud"),
        app_metadata=payload.get("app_metadata", {}),
        user_metadata=payload.get("user_metadata", {}),
    )


def require_roles(allowed_roles: List[UserRole]):
    async def role_checker(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required roles: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return role_checker
