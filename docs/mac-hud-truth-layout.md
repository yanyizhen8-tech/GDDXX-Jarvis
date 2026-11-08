# Follow-up: teardown title and pause subtitle

Apply only on a tree that matches `4f6a36f04d6c7bb26855b05e39e2aaf34b347bcd`, including when the earlier patches are still uncommitted.

Do not reset. Do not re-apply earlier patches. Do not touch the venv, models, settings, or the desktop shortcut.

```bash
cd /Users/a222/GDDXX-Jarvis
git apply --check --verbose /path/to/jarvis-hud-truth-layout-4f6a36f.patch
git apply --verbose /path/to/jarvis-hud-truth-layout-4f6a36f.patch
"/Users/a222/Library/Application Support/Jarvis/venv/bin/python" /Users/a222/GDDXX-Jarvis/app/launch.py
```

Rollback of this patch only:

```bash
git apply -R --check /path/to/jarvis-hud-truth-layout-4f6a36f.patch && git apply -R /path/to/jarvis-hud-truth-layout-4f6a36f.patch
```

During a hologram, the mic and tour pills move to the top edge so they no longer sit on the model title. A center line that this window wrote as microphone status follows pause and a still-silent resume. A conversation line is left as it is. Gestures stay off unless already saved on.
