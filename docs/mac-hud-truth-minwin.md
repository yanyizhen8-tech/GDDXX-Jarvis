# Follow-up: the 1100×700 dashboard

Apply only on a tree that matches `b7f736cfb2bbe8c059eaa552c3f81952b2464a7c`. Do not reset or re-apply earlier patches. Do not change the venv, models, settings, or the desktop shortcut. The window minimum stays 1100×700 and the default stays 1440×900.

```bash
cd /Users/a222/GDDXX-Jarvis
git apply --check --verbose /path/to/jarvis-hud-truth-minwin-b7f736c.patch
git apply --verbose /path/to/jarvis-hud-truth-minwin-b7f736c.patch
"/Users/a222/Library/Application Support/Jarvis/venv/bin/python" /Users/a222/GDDXX-Jarvis/app/launch.py
```

Rollback of this patch only:

```bash
git apply -R --check /path/to/jarvis-hud-truth-minwin-b7f736c.patch && git apply -R /path/to/jarvis-hud-truth-minwin-b7f736c.patch
```

Below 1180px the side columns were 280px, the top numbers were removed, and the columns clipped. Agent status is one line, the decorative sparkline steps aside, the column can scroll, and CPU/MEM/NET stay. 1440×900 is outside this band. A hologram still keeps the mic and tour pills at the top edge.
