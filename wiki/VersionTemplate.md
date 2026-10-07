# Version Template

Rules every Paths Games version follows: how steps are numbered, what each step contains, which
points recur at the end of every version, and how documentation is kept. Every
`documentation_vN/Roadmap.md` must respect this file.

## 1. Versions and steps

- Every major version (V0, V1, V2, …) has **exactly 42 steps**. Never more, never fewer.
- Each step is a minor version: step N of version X is `X.N.0`; `X.0.0` is the version start
  (kickoff, folder setup); patches during a step are `X.N.y` with `y` sequential.
- Step 42 is always the **launch** of the version.
- After a launch, urgent fixes are released as `X.42.z` (sequential `z`) and noted in
  `documentation_vX/Hotfixes.md`. Hotfixes are not planned in any roadmap.
- The next version restarts from `X+1.0.0`. The version number is bumped only by the owner.
- Store packages (Steam, Debian, Android) use their own numbering, mapped in the V3 docs.

## 2. Step content

- Every step has a title, one line of main goals and **5 to 8 sub-points**.
- Each sub-point ends with its scope tag: `(backend)` = all three backends (Java, Python, AWS),
  `(frontend)` = react-game and/or react-admin, `(tests)`, `(docs)`, `(infra)`, `(all)`.
- A step is done only when:
  - Java, Python and AWS are aligned on the same API contract (OpenAPI spec updated);
  - unit tests cover more than 95% of the new code (backends and frontends);
  - every Robot Framework suite is green on all three backends;
  - documentation is updated through `/doc-update`.

## 3. Overflow and reserved steps

- If a version has more work than 42 steps, the extra steps move to the next version (or to the
  previous one, if it is not launched yet and has room).
- If a version has less work, the free slots are marked **Reserved** and can receive steps moved
  from other versions. Reserved steps have no sub-points until they are filled.
- Multiplayer (V4 and V5) is the last feature block: it can slip to V20 or later if new ideas
  arrive. Nothing in earlier versions may break the party model (several characters per match).

## 4. Recurring points (steps 40-42)

| Step | Recurring content |
|------|-------------------|
| 40 | Security and hardening check of everything added in the version; update of the KPI report with the new mechanics |
| 41 | Migration of users and stories from the previous version's stage to the new one; privacy check (policy, consent, stored data) |
| 42 | New stage (own AWS stack, bucket and site); content license check; i18n check (EN, IT); Robot green on all backends; release notes; launch |

## 5. Stages

Each launch creates a new stage, named after the Greek alphabet: alpha (V0), beta (V1), gamma
(V2), delta (V3), epsilon (V4), zeta (V5), eta (V6). Domains are `<stage>.paths.games` and
`<stage>-api.paths.games`; the admin API never gets a paths.games DNS name. Older stages are
kept or shut down by the owner's choice. Details in [Environments](./Environments.md).

## 6. Workflow of a step

1. `paths-games-new-feature` agent analyses the step: it writes the draft step file
   `documentation_vN/StepXX_Name.md` with sub-points per component and a numbered list of doubts.
2. The owner answers the doubts; the analysis is updated until no doubt is open.
3. `paths-games-dev-feature` agent develops the analysed step on all backends and frontends,
   with unit tests and Robot suites, and runs the tests.
4. `/doc-update` (agent `paths-games-doc`) aligns the documentation.
5. The owner reviews, bumps the version and commits. Agents never commit and never bump versions.

## 7. Documentation rules

- Shared, version-independent docs live in `wiki/`; they describe the current state and
  must stay small. `paths-games-doc` keeps them updated.
- Each version has `wiki/documentation_vN/` with its `Roadmap.md`, its step files, `INDEX.md` (only
  that version's documents) and, after launch, `Hotfixes.md`. Images go in a `concepts/`
  subfolder when needed.
- Documents of launched, previous versions are **frozen history**: nobody edits them, except
  `Hotfixes.md`.
- `wiki/INDEX.md` is the single entry point: shared files plus one line per version.
- Every document ends with a Version Control section: **at most one row per version**, appended
  at the bottom, description of **one line with at most 10 plain, non-technical words**. If the
  current version already has a row, no new row is added: at most its description is extended
  with a short phrase. Rows of previous versions are never changed.
- Everything is written in English.

# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First version of the rules shared by every version | September 25, 2026 |

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
