# Mac apply / rollback for the HUD truth patch

Base commit on the installed tree: `7c36f0634005996b8d049569cb5ce8ee541f0671`.

This patch does not reinstall Jarvis, does not touch the venv, model files, `~/Library/Application Support/Jarvis`, `~/.jarvis` settings, or the desktop shortcut. It only changes dashboard code in the app directory.

Linux unit tests do not mean the Mac app was launched.

## Before applying

```bash
cd /Users/a222/GDDXX-Jarvis
git rev-parse HEAD
git status --short
```

Expect the recorded base `7c36f0634005996b8d049569cb5ce8ee541f0671`, or a descendant that has not already edited the files below. If `git status` shows local edits to any file in this patch, stop. Do not overwrite them. Send a sanitized diff of only those conflicting files (`git diff -- path`, with secrets removed) before retrying.

Copy `patches/jarvis-hud-truth-7c36f06.patch` from this branch onto the Mac, then:

```bash
cd /Users/a222/GDDXX-Jarvis
git apply --check --verbose /path/to/jarvis-hud-truth-7c36f06.patch
```

If `--check` reports a conflict, do not apply. If it is clean:

```bash
git apply --verbose /path/to/jarvis-hud-truth-7c36f06.patch
```

Restart with the existing interpreter. Do not run `app/install.py` and do not download models:

```bash
"/Users/a222/Library/Application Support/Jarvis/venv/bin/python" /Users/a222/GDDXX-Jarvis/app/launch.py
```

## Rollback

```bash
cd /Users/a222/GDDXX-Jarvis
git apply -R --check /path/to/jarvis-hud-truth-7c36f06.patch && git apply -R /path/to/jarvis-hud-truth-7c36f06.patch
```

Then start `app/launch.py` the same way. Rollback does not delete settings or models.

## What the screenshots were showing

| Module | Before this patch | After |
| --- | --- | --- |
| Clock, date | Real local clock | Unchanged |
| LOCAL ● ON | Hard-coded ON | ON only while `ws://127.0.0.1:8765` is connected; otherwise OFF |
| CPU / MEM / NET | Live psutil when the voice service is up (about every 2s). CPU is the short interval since the previous sample, memory is virtual-memory percent. With no service, MEM and NET were random lookalikes (55–60%, 4–8 MB/s). | Same psutil source, with a tooltip (source, window, sample time). First sample has no window, so CPU and NET stay `--`. Missing psutil says so. No invented numbers. A sample older than 15s is marked stale. |
| Search, mic (connected), HOLD SPACE (connected) | Search focuses the box. Mic / M toggles real listening. | Unchanged when connected. Disconnected mic and HOLD SPACE no longer type a canned sentence. |
| Shield | No click handler | Opens a local status list: voice, psutil, language model configured or not, AMap configured or not, Harness installed or not. No keys and no URLs. |
| Menu “语音播报” | Browser `speechSynthesis` only | Relabeled 演示播报. It still does not control the Mac voice service. |
| 3D 拆解 | Real library over the voice socket | Unchanged. If the socket is down it already says so. |
| Agent text | Real `agents.snapshot()` (the truncated “未安装 DeepSeek H…” is that string) | Same source. Description wraps to two lines. Jobs/Review in the `off` state do not ask the model; the subtitle shows the real reason. Brain still opens its window. |
| Agent sparklines | Decorative | Still decorative, titled as such |
| 工作汇报 / 今日安排 | Real schedule file once a `schedule` message arrives (empty day matched the screenshots). Before that, six fake meetings. | No fake meetings. “尚未同步” until the service sends the file. Empty day stays “还没有任务”. |
| AGENT/SYSTEM/TOOL/HUMAN wave | Sine wave. Tab change only retunes it. | SYSTEM draws CPU samples, HUMAN draws mic level, AGENT draws panel state. TOOL stays labeled 示意: there is no tool-event stream. |
| Bottom DATA/MODEL/AGENT/KNOWLEDGE/WORLD | Decorative. The “演示数据” tag hid itself once the socket connected. | Still decorative. The tag stays: “底部仪表 · 示意动画”. |
| 天气与出行 | HTML sample: 上海 18°C 多云 AQI 36, forecast 14/22, 16/24, 18/26. A real AMap push replaces it. No key meant the sample stayed forever, and the third weekday kept updating. | No sample city. Unconfigured AMap is an explicit empty state. A real forecast shows 高德, the observation time, and humidity. AQI is shown only if a payload actually contains it. |
| 去张江科学城 / ETA | Sample trip. ETA was `now + 32 min`, so it ticked (23:09 → 23:10) with no route query. The moving map was a fixed polyline. | No ticking sample ETA and no fake route line. A real `plan_route` / morning commute still draws its path and ETA. |
| Corner coordinates | Fixed Shanghai-looking degrees | Labeled 示意坐标 / 非本机定位 |
| 进入待机 chip | Only worked if the language model called `set_screen` | The panel hides immediately. The text is still sent when the socket is up. |
| Idle after launch | `body.dormant` hides the panels until a pointer or key event; quiet idle hides them again after about 15s (30s after a wake). A click that only focuses the window may never reach the page, so the next click is the one that opens the dashboard. | Not changed. Not treated as a defect. |

## Not faked, and not newly implemented

- DeepSeek Harness still has to be installed for BRAIN/JOBS. This patch does not download it.
- Weather and routing still need an AMap key already in the local config. This patch does not sign up, call the API from tests, or read the key out to the window.
- A language model is still required for free-form answers. Offline typed replies say the voice service is disconnected.
- Tool-call waveforms, the five bottom meters, and the agent sparklines are still decoration. They are labeled.

## Tests run here

```bash
node tests/test_hud_truth.js
python3 tests/test_hud_truth.py
```

They cover unconfigured and failed weather/route messages, secret stripping, psutil's first-versus-second sample flags, offline replies, standby, agent click actions, and wave captions. They do not open the Mac app.
