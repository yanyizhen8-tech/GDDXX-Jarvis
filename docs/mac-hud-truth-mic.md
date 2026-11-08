# Follow-up: microphone label and local 3D / module clicks

Apply this only on a tree that already has both HUD truth patches, including when those edits are still uncommitted. That tree matches commit `b670d3e78ccbe60e7c23d13165a276c97f81f054`.

Do not reset. Do not re-apply the earlier patches. Do not touch the venv, model files, settings, or desktop shortcut.

```bash
cd /Users/a222/GDDXX-Jarvis
git apply --check --verbose /path/to/jarvis-hud-truth-mic-b670d3e.patch
git apply --verbose /path/to/jarvis-hud-truth-mic-b670d3e.patch
"/Users/a222/Library/Application Support/Jarvis/venv/bin/python" /Users/a222/GDDXX-Jarvis/app/launch.py
```

If `--check` fails, stop.

Rollback of this patch only:

```bash
git apply -R --check /path/to/jarvis-hud-truth-mic-b670d3e.patch && git apply -R /path/to/jarvis-hud-truth-mic-b670d3e.patch
```

Then start `app/launch.py` the same way. The two earlier patches stay.

## What it changes

- “聆听中” is shown only after the audio stream has opened, the pause switch is on, and the stream is not silent. A connected socket by itself says the microphone is not confirmed yet. A missing device or a silent open device is stated. This does not prove a spoken “Hey Jarvis” was detected.
- JOBS and REVIEW clicks show the status already on the button. They do not send a chat line.
- A 3D library card calls `holo_show` on the local service. If the service is down or the file cannot be shown, the window says so. The “拆开一台发动机” chip remains a normal chat line.
