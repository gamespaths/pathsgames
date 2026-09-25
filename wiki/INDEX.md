# Documentation index

The single entry point of the Paths Games documentation. **Start here.** Shared documents are in
`wiki/` (current state, kept small); each version has its own folder
`documentation_vN/` with its roadmap, step files and its own `INDEX.md`.

Workflow: find the file here → open the version index if you need a step → `grep -n` for the
section → read only that line range. Never read a Step file whole; never open
`documentation_v0/website_concepts_v0/` (450 MB of images).

## 1. Shared documents

| File | What is in it | Keywords |
|---|---|---|
| `Roadmap.md` | All versions V0-V6: stage, theme, content, where the old 101 steps went | versions, stages, global roadmap |
| `VersionTemplate.md` | Rules of every version: 42 steps, sub-points, recurring steps 40-42, stages, docs rules | 42 steps, workflow, recurring, stages, hotfixes |
| `Backlog.md` | Every feature idea with its target version, open analyses | backlog, features, excluded, analyses |
| `DontThinkAbout.md` | Topics already decided, never to raise again | closed topics, decisions |
| `GameRules.md` | Game rules as implemented: characters, turns, time, weather, movement, events, choices, coma, inventory, registry, missions, exp; no combat | rules, turn, clock, coma, registry, missions, no combat |
| `DataModel.md` | Tables by domain, relationships, statuses, invariants, Flyway convention, DynamoDB single-table layout | schema, tables, invariants, flyway, dynamodb, GSI |
| `StoryFormat.md` | Story JSON import format, entity fields, texts and languages, validation rules R01-R11 | story, import, JSON, validation, texts |
| `Architecture.md` | Components, hexagonal modules, Python mirror, AWS lambdas, ports and profiles, CI | architecture, hexagonal, lambda, ports |
| `ApiConventions.md` | REST naming, contexts, versioning, error format, pagination, OpenAPI files | API, naming, OpenAPI, versioning |
| `Security.md` | Guest login, JWT, admin port and IP allow-list, rate limits, CSRF, sanitisation, CSP | security, JWT, admin, CSRF, rate limit |
| `Environments.md` | Environments, stages per version, domains, certificates, env variables | environments, stages, ACM, domains, env |
| `Glossary.md` | Domain terms with one-line meanings | glossary, terms |

## 2. Versions

| Folder | Version | What is in it |
|---|---|---|
| [`documentation_v0/`](documentation_v0/INDEX.md) | V0 alpha — current | Steps 1-39 done, alpha preparation and launch (40-42), historical step files, hotfixes |
| [`documentation_v1/`](documentation_v1/INDEX.md) | V1 beta — draft | Accounts and depth: SSO, profile, i18n, permadeath, admin tool |
| [`documentation_v2/`](documentation_v2/INDEX.md) | V2 gamma — draft | A living world: campaigns, NPCs, open world, analytics |
| [`documentation_v3/`](documentation_v3/INDEX.md) | V3 delta — draft | Everywhere: Android, Steam, Debian, offline and sync |
| [`documentation_v4/`](documentation_v4/INDEX.md) | V4 epsilon — draft | Multiplayer: realtime, lobby, turns, group movement |
| [`documentation_v5/`](documentation_v5/INDEX.md) | V5 zeta — draft | Advanced multiplayer: trade, chat, signals, voting, rituals, spectators |
| [`documentation_v6/`](documentation_v6/INDEX.md) | V6 eta — draft | Infrastructure: Kubernetes, Azure, Cloudflare, DR, monitoring |

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First single index for all documentation | September 25, 2026 |

- **Last Updated**: September 25, 2026 (v0.40.0)

# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website



## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.
