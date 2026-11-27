from datetime import datetime, timezone
from typing import Optional
import uuid
from fastapi import HTTPException
import httpx

from app.core.config import settings


def _require_storage_config() -> tuple[str, str, str]:
    supabase_url = settings.SUPABASE_URL.strip().rstrip("/")
    service_key = (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY).strip()
    bucket = settings.SUPABASE_STORAGE_BUCKET.strip() or "cow-profiles"
    if not supabase_url or not service_key:
        raise HTTPException(
            status_code=503,
            detail="Supabase Storage is not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).",
        )
    return supabase_url, service_key, bucket


def _extract_object_path(public_url: Optional[str], supabase_url: str, bucket: str) -> Optional[str]:
    if not public_url:
        return None
    clean_url = public_url.split("?", 1)[0]
    prefix = f"{supabase_url}/storage/v1/object/public/{bucket}/"
    if clean_url.startswith(prefix):
        return clean_url[len(prefix):]
    return None


async def upload_cow_profile_picture(
    cow_id: uuid.UUID,
    data: bytes,
    content_type: str,
    ext: str,
    previous_url: Optional[str] = None,
) -> str:
    supabase_url, service_key, bucket = _require_storage_config()
    version = int(datetime.now(timezone.utc).timestamp())
    object_path = f"{cow_id}/{version}{ext}"
    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"

    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "Content-Type": content_type,
        "x-upsert": "true",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(upload_url, content=data, headers=headers)

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to upload profile picture to Supabase Storage ({response.status_code}).",
        )

    old_path = _extract_object_path(previous_url, supabase_url, bucket)
    if old_path and old_path != object_path:
        await _delete_object(supabase_url, service_key, bucket, old_path)

    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"


async def delete_cow_profile_picture(previous_url: Optional[str]) -> None:
    if not previous_url:
        return
    supabase_url, service_key, bucket = _require_storage_config()
    object_path = _extract_object_path(previous_url, supabase_url, bucket)
    if not object_path:
        return
    await _delete_object(supabase_url, service_key, bucket, object_path)


async def _delete_object(supabase_url: str, service_key: str, bucket: str, object_path: str) -> None:
    delete_url = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.delete(delete_url, headers=headers)
    if response.status_code >= 400 and response.status_code != 404:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to delete profile picture from Supabase Storage ({response.status_code}).",
        )
