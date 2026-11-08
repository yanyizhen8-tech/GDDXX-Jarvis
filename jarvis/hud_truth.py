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


def mic_message(*, ready, silent=False, detail=""):
    """What the HUD may say about the microphone. `ready is None` means the socket is up and the device is not confirmed.

    A connected voice process is not a microphone permission, an open stream, or a successful wake."""
    if ready is None:
        return {"type": "mic", "ok": False, "pending": True, "silent": False,
                "text": "正在打开麦克风。连上语音服务不等于麦克风可用。"}
    if not ready:
        text = detail or "没有找到可用的麦克风或扬声器。接上设备后会自动重试；也可以先用文字输入。"
        return {"type": "mic", "ok": False, "pending": False, "silent": False, "text": public_error(text)}
    if silent:
        return {"type": "mic", "ok": True, "pending": False, "silent": True,
                "text": "麦克风设备已打开，但没有输入电平。请检查系统麦克风权限和当前输入设备。唤醒词需要有声音才会触发。"}
    return {"type": "mic", "ok": True, "pending": False, "silent": False, "text": ""}


def mic_transition(prev, msg):
    """Whether a new microphone snapshot should be sent. Repeats are dropped; a later failure is not."""
    return msg != prev


def holo_show_event(result, stem):
    """Library card result. Failure is explicit. Success is only the real show() result, not a preview."""
    name = str(stem or "")[:80]
    if not result or not result.get("ok"):
        err = (result or {}).get("error") or "无法投影这个拆解"
        return {"type": "holo_show", "ok": False, "file": name, "error": public_error(err)}
    return {"type": "holo_show", "ok": True, "file": name, "title": str(result.get("machine") or "")[:80]}


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
