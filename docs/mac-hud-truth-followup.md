# Follow-up patch (standby chip and status card)

Apply this only on a tree that already has the first HUD truth patch. That tree matches commit `5be3ead8927d548ed348d3f4437638bdac6b3357`, including when those edits are still uncommitted on top of `7c36f0634005996b8d049569cb5ce8ee541f0671`.

Do not re-apply `patches/jarvis-hud-truth-7c36f06.patch`. Do not reset the worktree. Do not touch the venv, model files, settings, or desktop shortcut.

```bash
cd /Users/a222/GDDXX-Jarvis
git apply --check --verbose /path/to/jarvis-hud-truth-followup-5be3ead.patch
git apply --verbose /path/to/jarvis-hud-truth-followup-5be3ead.patch
"/Users/a222/Library/Application Support/Jarvis/venv/bin/python" /Users/a222/GDDXX-Jarvis/app/launch.py
```

If `--check` fails, stop. The first patch's files differ from `5be3ead`. Send a sanitized diff of only the conflicting files.

## Rollback of this follow-up only

```bash
cd /Users/a222/GDDXX-Jarvis
git apply -R --check /path/to/jarvis-hud-truth-followup-5be3ead.patch && git apply -R /path/to/jarvis-hud-truth-followup-5be3ead.patch
```

This returns the dashboard code to the first patch. It does not remove the first patch and it does not restore the backup at `/Users/a222/Jarvis修复备份/20261108-2330/`. Start `app/launch.py` the same way afterward.

## What it changes

- The 进入待机 chip, and the same phrase typed in the box, only hides the local panels. The connected window does not send a chat message, so the language model is not called. Other chips still send. A spoken wake command is unchanged.
- The shield status card is `position: fixed` on the document, above the dashboard columns, with an opaque `#061018` fill so the weather labels cannot show through.
