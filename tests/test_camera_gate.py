"""Gesture camera stays closed unless the user asked, and an in-flight open is released.

    python tests/test_camera_gate.py

No camera, no OpenCV, no microphone. Linux only; it does not mean the Mac camera was opened.
"""
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from jarvis.gesture import Tracker


class Cap:
    def __init__(self, released):
        self.released = released
        self.reads = 0

    def read(self):
        self.reads += 1
        time.sleep(0.02)
        return True, None

    def release(self):
        self.released.append(threading.get_ident())


def wait_until(fn, seconds=1.0):
    end = time.time() + seconds
    while time.time() < end:
        if fn():
            return True
        time.sleep(0.01)
    return False


def test_turn_off_during_open_never_keeps_a_device():
    opened = []
    released = []
    gate = threading.Event()

    def slow_open(want, send):
        opened.append(1)
        gate.wait(0.5)
        if not want():
            return None
        return Cap(released)

    t = Tracker(open_camera=slow_open)
    t.set(True)
    assert wait_until(lambda: opened), "open was not started"
    t.set(False)
    gate.set()
    assert wait_until(lambda: not t.want and not t._alive_other())
    assert released == [], released
    assert t.want is False


def test_opened_device_is_released_once_and_a_late_start_does_not_stick():
    released = []
    entered = threading.Event()

    def open_ready(want, send):
        cap = Cap(released)
        entered.set()
        return cap if want() else None

    t = Tracker(open_camera=open_ready)
    t.set(True)
    assert wait_until(entered.is_set)
    assert wait_until(lambda: released == [] and t.thread and t.thread.is_alive())
    t.set(False)
    assert wait_until(lambda: len(released) == 1), released
    t.set(False)
    time.sleep(0.05)
    assert len(released) == 1
    assert t.want is False


def test_second_request_while_running_does_not_open_another_camera():
    calls = []
    hold = threading.Event()

    def open_hold(want, send):
        calls.append(1)
        cap = Cap([])
        hold.wait(0.4)
        return cap if want() else None

    t = Tracker(open_camera=open_hold)
    t.set(True)
    assert wait_until(lambda: len(calls) == 1)
    t.set(True)
    time.sleep(0.05)
    assert calls == [1], calls
    t.set(False)
    hold.set()
    assert wait_until(lambda: not t._alive_other())


def test_reenable_after_release_can_open_again():
    calls = []

    def open_ready(want, send):
        calls.append(1)
        return Cap([]) if want() else None

    t = Tracker(open_camera=open_ready)
    t.set(True)
    assert wait_until(lambda: len(calls) == 1)
    t.set(False)
    assert wait_until(lambda: not t._alive_other())
    t.set(True)
    assert wait_until(lambda: len(calls) == 2), calls
    t.set(False)
    assert wait_until(lambda: not t._alive_other())


if __name__ == "__main__":
    test_turn_off_during_open_never_keeps_a_device()
    test_opened_device_is_released_once_and_a_late_start_does_not_stick()
    test_second_request_while_running_does_not_open_another_camera()
    test_reenable_after_release_can_open_again()
    print("PASS")
