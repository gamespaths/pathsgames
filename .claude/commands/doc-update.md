---
description: Run the paths-games-doc subagent to sync documentation with the code changes just made
---

Launch the `paths-games-doc` subagent to update the project documentation.

Give it a **tight brief** so it does not read whole folders — `wiki/documentation_v0/` alone costs
~1M tokens. Tell it explicitly:

- exactly what changed in this session (components, APIs, DB columns, game rules, versions);
- which files it should look at, starting from `wiki/INDEX.md` (shared docs) and the
  current version's `wiki/documentation_vN/INDEX.md`;
- that it must grep for the right section and read line ranges, never `cat` a Step file whole.

Reminders for the subagent:
- it may only edit `.md` files and must never touch the root `README.md` unless asked;
- shared files in `wiki/` describe the current state and must stay small;
- documents of previous, launched versions are frozen (only their `Hotfixes.md` may change);
- Version Control rows: at most one row per version, one line, at most 10 plain non-technical
  words, appended at the bottom; if the current version already has a row, extend it with a short
  phrase instead of adding a new row; never touch rows of previous versions;
- everything in English;
- skip style-only or trivial code changes.

If nothing meaningful changed (no new/removed/updated component, API, schema or rule), say so and
do not launch the subagent.

$ARGUMENTS
