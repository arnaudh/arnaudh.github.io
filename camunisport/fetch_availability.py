#!/usr/bin/env python3
"""Fetch CamUniSport padel availability and emit JSON for static hosting."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any


APP_ID_DEFAULT = "275"
APP_IDENTIFIER_DEFAULT = "universityofcambridgesport_android"
HOST_DEFAULT = "https://api.myfitapp.de"
LOCALE_DEFAULT = "en_GB"
CLUB_ID_DEFAULT = 46829
APP_VERSION_CODE_DEFAULT = "10693"
APP_VERSION_NAME_DEFAULT = "106.93"
APP_STATIC_BEARER_DEFAULT = "680857c4038d4571a0ec25f8efd6e80a"
APP_USER_AGENT_DEFAULT = "universityofcambridgesport/10693 Android 14 Pixel"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fetch CamUniSport availability JSON, just like the app does it.")
    p.add_argument("--json-out", required=True, help="Output file path.")
    p.add_argument("--keyword", default="padel", help='Filter keyword. Default: "padel".')
    p.add_argument("--days", type=int, default=14, help="Horizon in days. Default: 14.")
    p.add_argument("--club-id", type=int, default=CLUB_ID_DEFAULT)
    p.add_argument("--host", default=HOST_DEFAULT)
    p.add_argument("--locale", default=LOCALE_DEFAULT)
    p.add_argument("--username", default=os.getenv("CAM_UNI_SPORTS_USERNAME", ""))
    p.add_argument("--password", default=os.getenv("CAM_UNI_SPORTS_PASSWORD", ""))
    return p.parse_args()


@dataclass
class GSCredentials:
    base_url: str
    api_key: str


def _json_get(url: str, *, params: dict[str, Any], headers: dict[str, str]) -> Any:
    query = urllib.parse.urlencode(params, doseq=True)
    full_url = f"{url}?{query}" if query else url
    req = urllib.request.Request(full_url, method="GET")
    for key, value in headers.items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=25) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    return json.loads(body)


def fetch_home_config(host: str, club_id: int, locale: str) -> dict[str, Any]:
    url = f"{host.rstrip('/')}/mob/homeScreen/{club_id}"
    params = {
        "c": club_id,
        "locale": locale,
        "uid": str(uuid.uuid4()),
        "app": APP_IDENTIFIER_DEFAULT,
        "appId": APP_ID_DEFAULT,
        "appid": APP_ID_DEFAULT,
        "appInstallationId": "temp",
        "appver": APP_VERSION_CODE_DEFAULT,
        "w": 1080,
        "h": 2400,
    }
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {APP_STATIC_BEARER_DEFAULT}",
        "appversion": APP_VERSION_NAME_DEFAULT,
        "User-Agent": APP_USER_AGENT_DEFAULT,
    }
    return _json_get(url, params=params, headers=headers)


def extract_gs_credentials(home_json: dict[str, Any]) -> GSCredentials:
    gs_settings = (home_json.get("modTypeSettings") or {}).get("7") or {}
    base_url = gs_settings.get("baseUrl")
    api_key = gs_settings.get("apiKey")
    if not base_url or not api_key:
        raise RuntimeError("Could not discover GS baseUrl/apiKey from homeScreen.")
    return GSCredentials(base_url=base_url.rstrip("/"), api_key=api_key)


def fetch_activity_list(
    gs: GSCredentials, locale: str, username: str, password: str
) -> dict[str, Any]:
    url = f"{gs.base_url}/api/activity/list"
    headers = {
        "Accept": "application/json",
        "AuthenticationKey": gs.api_key,
        "User-Agent": APP_USER_AGENT_DEFAULT,
    }
    if username and password:
        headers["user"] = username
        headers["pw"] = password
    return _json_get(url, params={"locale": locale, "globalInfo": 1}, headers=headers)


def fetch_activity_availability(
    gs: GSCredentials,
    activity_id: str,
    from_utc: int,
    to_utc: int,
    locale: str,
    username: str,
    password: str,
) -> dict[str, Any]:
    url = f"{gs.base_url}/api/activity/availability"
    headers = {
        "Accept": "application/json",
        "AuthenticationKey": gs.api_key,
        "User-Agent": APP_USER_AGENT_DEFAULT,
    }
    if username and password:
        headers["user"] = username
        headers["pw"] = password
    params = {
        "locale": locale,
        "activityId": activity_id,
        "fromUTC": from_utc,
        "toUTC": to_utc,
    }
    return _json_get(url, params=params, headers=headers)


def flatten_activities(activity_list_json: dict[str, Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for type_obj in activity_list_json.get("types", []):
        type_name = str(type_obj.get("n") or type_obj.get("name") or "").strip()
        for site_obj in type_obj.get("sites", []):
            site_name = str(site_obj.get("n") or site_obj.get("name") or "").strip()
            for activity_obj in site_obj.get("acts", []):
                act_id = str(activity_obj.get("id") or "").strip()
                title = str(
                    activity_obj.get("n")
                    or activity_obj.get("title")
                    or activity_obj.get("name")
                    or ""
                ).strip()
                if act_id:
                    out.append(
                        {"id": act_id, "title": title, "site": site_name, "type": type_name}
                    )
    return out


def to_int_or(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def parse_slot_counts(slot: dict[str, Any]) -> tuple[int, int]:
    status = to_int_or(slot.get("s", -1), -1)
    if status == 1:
        return 1, 1
    if status >= 0:
        return 0, 1
    return 0, 0


def main() -> int:
    args = parse_args()
    now_utc = int(dt.datetime.now(tz=dt.timezone.utc).timestamp())
    to_utc = int((dt.datetime.now(tz=dt.timezone.utc) + dt.timedelta(days=args.days)).timestamp())
    keyword = args.keyword.lower().strip()

    try:
        home = fetch_home_config(args.host, args.club_id, args.locale)
        gs = extract_gs_credentials(home)
        activity_list_json = fetch_activity_list(gs, args.locale, args.username, args.password)
    except urllib.error.HTTPError as e:
        print(f"[HTTP ERROR] {e.code}: {e.reason}", file=sys.stderr)
        return 2
    except urllib.error.URLError as e:
        print(f"[NETWORK ERROR] {e.reason}", file=sys.stderr)
        return 2
    except Exception as e:  # noqa: BLE001
        print(f"[ERROR] {e}", file=sys.stderr)
        return 2

    all_activities = flatten_activities(activity_list_json)
    targets = [
        a
        for a in all_activities
        if keyword in f"{a['title']} {a['site']} {a['type']}".lower()
    ]
    if not targets:
        print(f'No activities matched "{args.keyword}".', file=sys.stderr)
        return 1

    results: list[dict[str, Any]] = []
    for activity in targets:
        try:
            av = fetch_activity_availability(
                gs,
                activity["id"],
                now_utc,
                to_utc,
                args.locale,
                args.username,
                args.password,
            )
            slots: list[dict[str, Any]] = []
            for bookable in av.get("bookableItems", []):
                b_name = str(bookable.get("n") or bookable.get("name") or "")
                b_id = str(bookable.get("id") or "")
                for slot in bookable.get("slots", []):
                    start_utc = int(slot.get("sUTC", 0))
                    if start_utc <= 0:
                        continue
                    available, total = parse_slot_counts(slot)
                    slots.append(
                        {
                            "start_utc": dt.datetime.fromtimestamp(
                                start_utc, tz=dt.timezone.utc
                            ).isoformat(),
                            "available": available,
                            "total": total,
                            "bookable_item_name": b_name,
                            "bookable_item_id": b_id,
                        }
                    )
            slots.sort(key=lambda s: s["start_utc"])
            results.append({"activity": activity, "slot_count": len(slots), "slots": slots})
        except Exception as e:  # noqa: BLE001
            results.append(
                {"activity": activity, "slot_count": 0, "slots": [], "error": str(e)}
            )

    payload = {
        "meta": {
            "club_id": args.club_id,
            "host": args.host,
            "gs_base_url": gs.base_url,
            "keyword": args.keyword,
            "from_utc": now_utc,
            "to_utc": to_utc,
            "generated_at_utc": dt.datetime.now(tz=dt.timezone.utc).isoformat(),
        },
        "results": results,
    }

    with open(args.json_out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote JSON output to {args.json_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
