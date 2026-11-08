# Follow-up: 3D view must not open the camera

Apply this only on a tree that already matches commit `c85a093af50e9b33837fb6028034bb7aa678466d`, including when the earlier HUD patches are still uncommitted on top of `7c36f0634005996b8d049569cb5ce8ee541f0671`.

Do not reset. Do not re-apply the earlier patches. Do not touch the venv, model files, settings, or desktop shortcut.

```bash
cd /Users/a222/GDDXX-Jarvis
git apply --check --verbose /path/to/jarvis-hud-truth-camera-c85a093.patch
git apply --verbose /path/to/jarvis-hud-truth-camera-c85a093.patch
"/Users/a222/Library/Application Support/Jarvis/venv/bin/python" /Users/a222/GDDXX-Jarvis/app/launch.py
```

If `--check` fails, stop.

Rollback of this patch only:

```bash
git apply -R --check /path/to/jarvis-hud-truth-camera-c85a093.patch && git apply -R /path/to/jarvis-hud-truth-camera-c85a093.patch
```

Then start `app/launch.py` the same way.

## What it changes

Showing a 3D teardown no longer asks for the camera. Gesture control stays available from the chip in the teardown view, and it starts off unless this Mac already saved `jarvis.hand` as `on`. Leaving the demo, or turning the chip off, sends `camera off` immediately. An open that is still waiting is dropped and any device it already holds is released. There is no browser `getUserMedia` call. The camera is the voice service's OpenCV capture, and only after that explicit chip.
