---
description: Run the paths-games-doc subagent to sync documentation with the code changes just made
---

Launch the `paths-games-doc` subagent to update the project documentation.

Give it a **tight brief** so it does not read the whole `documentation_v0/` folder — that
costs ~1M tokens. Tell it explicitly:

- exactly what changed in this session (components, APIs, DB columns, versions);
- which files it should look at, from `documentation_v0/INDEX.md`;
- that it must grep for the right section and read line ranges, never `cat` a Step file whole.

Reminders for the subagent: it may only edit `.md` files, it must never touch the root
`README.md`, and it should skip style-only or trivial code changes.

If nothing meaningful changed (no new/removed/updated component, API, or schema), say so and
do not launch the subagent.

$ARGUMENTS
