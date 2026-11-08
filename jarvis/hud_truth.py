"""Messages the HUD may show for weather, routes, and the local link light.

The window used to keep a Shanghai / 张江科学城 sample on screen whenever AMap was
not configured, and it hid the "demo data" label as soon as the voice socket
connected. These helpers tell the truth instead: unconfigured, failed, or no
route yet. They never include API keys.
"""
import re

_SECRET = re.compile(r"(key|token|secret|api_key|access_key)=([^&\s\"']+)", re.I)
_URL = re.compile(r"https?://\S+")
_PROVIDER = re.compile(r"[A-Za-z0-9._-]{1,32}")

WEATHER_UNCONFIGURED = "未配置高德 Web 服务密钥。天气留空，不显示示例城市。"
WEATHER_ERROR = "天气查询失败。"
TRIP_UNCONFIGURED = "未配置高德，不显示示例行程。"
TRIP_NONE = "还没有路线。说出目的地后再查询；工作日早晨若已保存家和公司，会尝试通勤路线。"


def public_error(text) -> str:
    """A short error safe to put on screen or in the local log."""
    s = _SECRET.sub(lambda m: m.group(1) + "=…", str(text or ""))
    s = _URL.sub("…", s).replace("\n", " ").strip()
    return (s or WEATHER_ERROR)[:180]


def weather_message(*, has_key, weather=None, error=""):
    if not has_key:
        return {"type": "weather", "ok": False, "reason": "unconfigured", "detail": WEATHER_UNCONFIGURED}
    if error or not weather:
        return {"type": "weather", "ok": False, "reason": "error", "detail": public_error(error) or WEATHER_ERROR}
    msg = dict(weather)
    msg["type"] = "weather"
    msg["ok"] = True
    msg["source"] = "amap"
    return msg


def trip_message(*, has_key, has_route):
    if not has_key:
        return {"type": "trip", "ok": False, "reason": "unconfigured", "detail": TRIP_UNCONFIGURED}
    if not has_route:
        return {"type": "trip", "ok": False, "reason": "none", "detail": TRIP_NONE}
    return None


def world_messages(*, has_amap, has_key, weather=None, weather_error="", has_route=False):
    """What push_world should send. A real route is broadcast separately by push_trip."""
    key = bool(has_amap and has_key)
    msgs = [weather_message(has_key=key, weather=weather, error=weather_error)]
    trip = trip_message(has_key=key, has_route=has_route)
    if trip:
        msgs.append(trip)
    return msgs


def link_message(*, voice, psutil, llm, llm_provider="", amap, harness):
    """Booleans only. Provider is a short name, never a URL or a key."""
    name = str(llm_provider or "")
    if not _PROVIDER.fullmatch(name):
        name = ""
    return {
        "type": "link",
        "voice": bool(voice),
        "psutil": bool(psutil),
        "llm": bool(llm),
        "llm_provider": name,
        "amap": bool(amap),
        "harness": bool(harness),
    }
