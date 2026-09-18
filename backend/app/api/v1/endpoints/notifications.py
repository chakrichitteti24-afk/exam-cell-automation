import asyncio
import ipaddress
import json
import os
import urllib.parse
from typing import Dict, List, Any
import pywebpush
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.push_subscription import PushSubscription

router = APIRouter()

# In-memory queues for SSE broadcasting per user
user_sse_queues: Dict[int, List[asyncio.Queue]] = {}

def _resolve_vapid_key_path() -> str:
    path = settings.VAPID_PRIVATE_KEY_PATH
    if os.path.isabs(path):
        return path
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    return os.path.join(backend_dir, path)

VAPID_CLAIMS = {"sub": settings.VAPID_CLAIMS_SUB}

class PushKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushKeys

    @field_validator("endpoint")
    @classmethod
    def validate_push_endpoint(cls, v: str) -> str:
        parsed = urllib.parse.urlparse(v.strip())
        if parsed.scheme.lower() != "https":
            raise ValueError("Push endpoint must use secure HTTPS protocol.")
        
        hostname = parsed.hostname
        if not hostname:
            raise ValueError("Push endpoint must contain a valid hostname.")

        # Reject loopback hostnames
        if hostname.lower() in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            raise ValueError("Push endpoint cannot point to loopback addresses.")

        # Prevent SSRF to internal/private IP ranges
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
                raise ValueError("Push endpoint cannot point to private or internal network addresses.")
        except ValueError as ex:
            # If not an IP literal, it's a domain name - ensure it contains at least one dot
            if "." not in hostname:
                raise ValueError("Push endpoint hostname must be a fully qualified domain name.")
        
        return v.strip()

@router.post("/subscribe", status_code=status.HTTP_200_OK)
def subscribe(
    payload: PushSubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Saves a device's PushSubscription credentials for the authenticated user.
    Validates push endpoint to prevent Server-Side Request Forgery (SSRF).
    """
    existing = db.execute(select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)).scalar_one_or_none()
    
    if existing:
        existing.user_id = current_user.id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
    else:
        new_sub = PushSubscription(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth
        )
        db.add(new_sub)
    
    db.commit()
    return {"status": "subscribed"}

@router.get("/vapid-public-key")
def get_vapid_public_key():
    """
    Returns the VAPID public key needed for the frontend to subscribe to Push.
    """
    return {"key": settings.VAPID_PUBLIC_KEY}

@router.get("/stream")
async def sse_stream(current_user: User = Depends(get_current_user)):
    """
    Server-Sent Events (SSE) endpoint for real-time foreground notifications.
    """
    if current_user.id not in user_sse_queues:
        user_sse_queues[current_user.id] = []
    
    q = asyncio.Queue()
    user_sse_queues[current_user.id].append(q)

    async def event_generator():
        try:
            while True:
                msg = await q.get()
                yield f"data: {json.dumps(msg)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if current_user.id in user_sse_queues and q in user_sse_queues[current_user.id]:
                user_sse_queues[current_user.id].remove(q)
            if current_user.id in user_sse_queues and not user_sse_queues[current_user.id]:
                del user_sse_queues[current_user.id]

    return StreamingResponse(event_generator(), media_type="text/event-stream")

def broadcast_notification(db: Session, user_ids: List[int], payload: Dict[str, Any]):
    """
    Utility function to send a Web Push AND SSE message to the given users.
    Should be called from a background task or inline during critical actions.
    """
    # 1. Broadcast to open SSE connections (foreground)
    for uid in user_ids:
        if uid in user_sse_queues:
            for q in user_sse_queues[uid]:
                try:
                    q.put_nowait(payload)
                except Exception:
                    pass
                
    # 2. Send Web Push to registered devices (background/locked)
    key_path = _resolve_vapid_key_path()
    if not os.path.exists(key_path):
        print(f"[NOTIFICATIONS] VAPID private key file not found at {key_path}. Skipping Web Push.")
        return

    subs = db.execute(select(PushSubscription).where(PushSubscription.user_id.in_(user_ids))).scalars().all()
    
    for sub in subs:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth
            }
        }
        try:
            pywebpush.webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=key_path,
                vapid_claims=VAPID_CLAIMS
            )
        except pywebpush.WebPushException as ex:
            print("Web Push Error:", repr(ex))
            if ex.response and ex.response.status_code in [404, 410]:
                try:
                    db.delete(sub)
                    db.commit()
                except Exception:
                    db.rollback()
        except Exception as ex:
            print("Unknown Push Error:", repr(ex))
