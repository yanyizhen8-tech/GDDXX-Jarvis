"""HUD truth messages: unconfigured weather must not look like a live Shanghai forecast.

    python tests/test_hud_truth.py

No network, no API keys, no voice models. Linux-only; it does not claim the Mac app was exercised.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from jarvis import hud_truth, sysmon


def test_public_error_strips_secrets_and_urls():
    text = hud_truth.public_error("failed https://restapi.amap.com/v3/ip?key=supersecret123&output=json token=abc")
    assert "supersecret" not in text
    assert "token=abc" not in text
    assert "https://" not in text
    bare = hud_truth.public_error("AMap rejected key=supersecret123")
    assert "supersecret" not in bare and "key=…" in bare


def test_unconfigured_world_is_explicit_and_not_the_sample_city():
    msgs = hud_truth.world_messages(has_amap=False, has_key=False)
    blob = json.dumps(msgs, ensure_ascii=False)
    assert "上海" not in blob and "张江" not in blob and "AQI" not in blob and "18" not in blob
    kinds = {(m["type"], m["reason"]) for m in msgs}
    assert kinds == {("weather", "unconfigured"), ("trip", "unconfigured")}
    assert all(m["ok"] is False for m in msgs)


def test_weather_error_and_no_route():
    msgs = hud_truth.world_messages(has_amap=True, has_key=True, weather=None, weather_error="timeout", has_route=False)
    assert msgs[0]["type"] == "weather" and msgs[0]["ok"] is False and msgs[0]["reason"] == "error"
    assert msgs[0]["detail"] == "timeout"
    assert msgs[1]["type"] == "trip" and msgs[1]["reason"] == "none"


def test_live_weather_keeps_source_and_does_not_invent_aqi():
    weather = {"ok": True, "city": "上海", "now": "多云", "temp": "18", "humidity": "60",
               "report_time": "2026-11-08 14:00:00", "days": [{"day": "多云"}]}
    msgs = hud_truth.world_messages(has_amap=True, has_key=True, weather=weather, has_route=True)
    assert len(msgs) == 1, "a route already on screen is not replaced with an empty trip"
    msg = msgs[0]
    assert msg["source"] == "amap" and msg["ok"] is True and msg["temp"] == "18"
    assert "aqi" not in msg


def test_mic_message_separates_socket_from_device():
    pending = hud_truth.mic_message(ready=None)
    assert pending["pending"] is True and pending["ok"] is False
    assert "不等于" in pending["text"]
    missing = hud_truth.mic_message(ready=False)
    assert missing["ok"] is False and missing["pending"] is False and "麦克风" in missing["text"]
    silent = hud_truth.mic_message(ready=True, silent=True)
    assert silent["ok"] is True and silent["silent"] is True and "电平" in silent["text"]
    ready = hud_truth.mic_message(ready=True, silent=False)
    assert ready["ok"] is True and ready["silent"] is False and ready["text"] == ""
    leaked = hud_truth.mic_message(ready=False, detail="open failed key=supersecret123")
    assert "supersecret" not in leaked["text"]


def test_holo_show_event_reports_failure_and_real_success():
    bad = hud_truth.holo_show_event({"ok": False, "error": "no hologram model for that machine is stored yet"}, "../raptor")
    assert bad["ok"] is False and bad["type"] == "holo_show" and "no hologram" in bad["error"]
    assert bad["file"] == "../raptor"[:80]
    none = hud_truth.holo_show_event(None, "missing")
    assert none["ok"] is False and none["error"]
    good = hud_truth.holo_show_event({"ok": True, "machine": "Raptor"}, "raptor-engine")
    assert good == {"type": "holo_show", "ok": True, "file": "raptor-engine", "title": "Raptor"}


def test_link_message_has_no_secrets():
    msg = hud_truth.link_message(voice=True, psutil=True, llm=True, llm_provider="deepseek", amap=False, harness=False)
    assert set(msg) == {"type", "voice", "psutil", "llm", "llm_provider", "amap", "harness"}
    assert msg["llm_provider"] == "deepseek" and msg["amap"] is False
    leaked = hud_truth.link_message(voice=True, psutil=False, llm=True, llm_provider="https://keys.example/secret", amap=True, harness=False)
    assert leaked["llm_provider"] == ""
    blob = json.dumps(msg)
    assert "key" not in blob and "token" not in blob


def test_sysmon_marks_the_first_reading_and_a_real_second_one():
    if sysmon.psutil is None:
        missing = sysmon.unavailable()
        assert missing["ok"] is False and missing["reason"] == "missing"
        assert "估算" in missing["detail"]
        return
    sysmon._last.update(t=0.0, sent=0, recv=0)
    first = sysmon.sample()
    assert first["ok"] is True and first["source"] == "psutil"
    assert first["cpu_ready"] is False and first["cpu"] is None
    assert first["net_ready"] is False and first["up"] is None and first["down"] is None
    assert first["mem_kind"] == "virtual_percent"
    assert isinstance(first["mem"], int)
    time.sleep(0.05)
    second = sysmon.sample()
    assert second["cpu_ready"] is True and isinstance(second["cpu"], int) and 0 <= second["cpu"] <= 100
    assert second["net_ready"] is True and isinstance(second["up"], int) and isinstance(second["down"], int)
    assert second["cpu_window_s"] is not None and second["cpu_window_s"] >= 0
    assert "api_key" not in json.dumps(second)


def main():
    test_public_error_strips_secrets_and_urls()
    test_unconfigured_world_is_explicit_and_not_the_sample_city()
    test_weather_error_and_no_route()
    test_live_weather_keeps_source_and_does_not_invent_aqi()
    test_mic_message_separates_socket_from_device()
    test_holo_show_event_reports_failure_and_real_success()
    test_link_message_has_no_secrets()
    test_sysmon_marks_the_first_reading_and_a_real_second_one()
    print("PASS")


if __name__ == "__main__":
    main()
