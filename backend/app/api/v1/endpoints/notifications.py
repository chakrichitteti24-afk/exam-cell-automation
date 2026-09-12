import asyncio
import json
import pywebpush
from typing import Dict, List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.push_subscription import PushSubscription

router = APIRouter()

# In-memory queues for SSE broadcasting per user
user_sse_queues: Dict[int, List[asyncio.Queue]] = {}

# Constants
VAPID_PUBLIC_KEY = "BGRLRqJSrhA3m25HfGogDzaApqqM_oS_TJ5O6YpIMKO2VzesVMI_td9ouf_J2rJupWXb4X3u87R8zyjsqt6HXKE"
VAPID_PRIVATE_KEY_PATH = "private_key.pem"
VAPID_CLAIMS = {"sub": "mailto:admin@gkce.edu.in"}

class PushKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushKeys

@router.post("/subscribe", status_code=status.HTTP_200_OK)
def subscribe(
    payload: PushSubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Saves a device's PushSubscription credentials for the authenticated user.
    """
    existing = db.execute(select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)).scalar_one_or_none()
    
    if existing:
        if existing.user_id != current_user.id:
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
    return {"key": VAPID_PUBLIC_KEY}

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
            user_sse_queues[current_user.id].remove(q)
            if not user_sse_queues[current_user.id]:
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
                q.put_nowait(payload)
                
    # 2. Send Web Push to registered devices (background/locked)
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
                vapid_private_key=VAPID_PRIVATE_KEY_PATH,
                vapid_claims=VAPID_CLAIMS
            )
        except pywebpush.WebPushException as ex:
            print("Web Push Error:", repr(ex))
            # Optional: if ex.response.status_code == 410, delete the sub as it's unsubscribed
            if ex.response and ex.response.status_code in [404, 410]:
                db.delete(sub)
                db.commit()
        except Exception as ex:
            print("Unknown Push Error:", repr(ex))
