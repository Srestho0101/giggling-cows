import enum
import uuid
import asyncio
from functools import lru_cache
from typing import List, Optional
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

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
    app_metadata: dict = Field(default_factory=dict)
    user_metadata: dict = Field(default_factory=dict)


def extract_role_from_payload(payload: dict) -> UserRole:
    # user_metadata is editable by the signed-in user, so it cannot grant roles.
    # app_metadata is managed by trusted administrators and is safe for role claims.
    app_meta = payload.get("app_metadata", {})
    if isinstance(app_meta, dict) and "role" in app_meta:
        role_str = str(app_meta["role"]).lower()
        if role_str in [r.value for r in UserRole]:
            return UserRole(role_str)

    # Check a direct role claim when one is supplied by a trusted JWT issuer.
    role_str = payload.get("role")
    if role_str and str(role_str).lower() in [r.value for r in UserRole]:
        return UserRole(str(role_str).lower())

    # Default role for authenticated users if unspecified
    return UserRole.DATA_ENTRY


@lru_cache(maxsize=1)
def get_supabase_jwks_client() -> PyJWKClient:
    return PyJWKClient(
        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json",
        cache_jwk_set=True,
    )


async def decode_supabase_jwt(token: str) -> dict:
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
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")

        if algorithm == "HS256":
            if not settings.SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="HS256 authentication is not configured on the server",
                )
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        elif algorithm in {"ES256", "RS256"}:
            if not settings.SUPABASE_URL:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="SUPABASE_URL is required to verify asymmetric auth tokens",
                )
            signing_key = await asyncio.to_thread(
                get_supabase_jwks_client().get_signing_key_from_jwt,
                token,
            )
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                options={"verify_aud": False},
            )
        else:
            raise jwt.InvalidAlgorithmError("Unsupported Supabase JWT signing algorithm")
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

    payload = await decode_supabase_jwt(credentials.credentials)
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
