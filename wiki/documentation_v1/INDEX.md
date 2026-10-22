# Documentation index — V1

Map of `documentation_v1/`: only the documents of version V1 (beta, accounts and depth). Shared
documents and the other versions are listed in the global index
[wiki/INDEX.md](../INDEX.md).

| File | What is in it | Keywords |
|---|---|---|
| `Roadmap.md` | Plan of the 42 steps of V1, steps 1-5 done | roadmap, steps, beta, draft |
| `Step01_Version1Launch.md` | V1 launch: daily AWS smoke test Lambda, schedule, alarms, TTL | smoke test, alarms, fast locations, registry lock, OpenAPI |
| `Step02_GoogleSsoIdentityModel.md` | Google SSO identity table, nickname rules, username mapping (developed 1.2.0) | identities, nickname, users table, migration, DynamoDB |
| `Step03_GoogleSsoBackendFlow.md` | Google ID token login, hashed sessions, replay, rate limit, admin bootstrap (developed 1.2.0) | google login, ID token, nonce, refresh, JWKS |
| `Step04_GoogleSsoReactGameLogin.md` | react-game Google button, guest linking, logout (developed 1.2.0) | GIS popup, guest linking, logout, consent |
| `Step05_GoogleSsoPrivacyE2E.md` | Account deletion, retention, policies, fake provider E2E (developed 1.2.0) | deletion, retention, policy, Robot, stage transfer |
| `Step06_UserProfileBackend.md` | Analysis: match stamp on every write, play time, `/me` statistics and preferences | ts_update, play_ms, statistics, preferences, GSI4 |
| `Step07_UserProfileReactGame.md` | Analysis: profile page, preferences, log out everywhere, account deletion UI | profile page, preferences, logout all, deletion |
| `Step08_MatchConcurrencyMultiDevice.md` | Analysis: `If-Match` and `STALE_MATCH`, claim first, refetch on return | matchVersion, If-Match, STALE_MATCH, refetch, DynamoDB chunks |
| `Step09_MatchListCancelledLastPlayed.md` | Analysis: match list (last played, cancelled toggle) and merge rule, Google match wins | tsUpdate, cancelled, merge rule, cancelledMatchUuids |
| `Step10_AdminUserManagementBackend.md` | Analysis: admin users list, ban with BANNED matches, suspend, unblock, log writer | admin users, ban, BANNED, GSI3, intervention log |
| `Step11_AdminUserManagementPages.md` | Analysis: react-admin users list, detail and action dialogs | users page, dialogs, reason, suspend date |
| `Step12_PaginationAndMultiDeviceContinuity.md` | Analysis: admin paging residuals, session cap, logout-all, refresh 30 days, A-B-C Robot | pagination, SESSION_LIMIT, sessions_valid_after, SameSite |

# Version Control
- **Document Version**: 1.4.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First index of this version's documents | September 25, 2026 |
  | 1.0.0 | Version launch step added | October 13, 2026 |
  | 1.1.0 | Google login analysis added | October 19, 2026 |
  | 1.2.0 | Google login developed | October 20, 2026 |
  | 1.4.0 | Profile, many-device and admin user steps analysed | October 21, 2026 |

- **Last Updated**: October 21, 2026 (v1.4.0)

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
