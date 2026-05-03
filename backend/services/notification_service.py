"""Notification Service — in-app only.

Every agent that wants to surface something to a tutor goes through `create()`.
The Bell icon in AppShell polls list_unread().
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from db.supabase_client import supabase

VALID_PRIORITIES = {"low", "normal", "high", "urgent"}


async def create(
    recipient_tutor_id: str,
    category: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
    priority: str = "normal",
    payload: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Insert a notification. Returns the notification id, or None on failure."""
    if priority not in VALID_PRIORITIES:
        priority = "normal"
    try:
        row = {
            "recipient_tutor_id": recipient_tutor_id,
            "category": category,
            "title": title,
            "body": body,
            "link": link,
            "payload": payload,
            "priority": priority,
            "created_at": datetime.now().isoformat(),
        }
        res = supabase.table("notifications").insert(row).execute()
        return res.data[0]["id"] if res.data else None
    except Exception as e:
        print(f"[notifications] create failed: {e}")
        return None


async def list_for_tutor(tutor_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    res = supabase.table("notifications") \
        .select("*") \
        .eq("recipient_tutor_id", tutor_id) \
        .order("read_at", desc=False, nullsfirst=True) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
    return res.data or []


async def list_unread(tutor_id: str) -> List[Dict[str, Any]]:
    res = supabase.table("notifications") \
        .select("*") \
        .eq("recipient_tutor_id", tutor_id) \
        .is_("read_at", "null") \
        .order("created_at", desc=True) \
        .execute()
    return res.data or []


async def mark_read(notification_id: str) -> None:
    supabase.table("notifications") \
        .update({"read_at": datetime.now().isoformat()}) \
        .eq("id", notification_id) \
        .execute()


async def mark_all_read(tutor_id: str) -> int:
    res = supabase.table("notifications") \
        .update({"read_at": datetime.now().isoformat()}) \
        .eq("recipient_tutor_id", tutor_id) \
        .is_("read_at", "null") \
        .execute()
    return len(res.data or [])
