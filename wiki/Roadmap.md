# Paths Games — Global Roadmap

The map of all Paths Games versions. Each version has 42 steps (see
[Version Template](./VersionTemplate.md)) and its own detailed roadmap in `documentation_vN/`.
Features not yet placed in a step are in the [Backlog](./Backlog.md).

## 1. Versions

| Version | Stage | Theme | Main content | Status | Roadmap |
|---------|-------|-------|--------------|--------|---------|
| V0 | alpha | Single-player alpha | Guest login, stories, full single-player engine (steps 1-39), alpha preparation (40-41), alpha launch on AWS (42) | In progress | [V0](documentation_v0/Roadmap.md) |
| V1 | beta | Accounts and depth | Google SSO, profile, guest linking, EN/IT and accessibility, optional audio, env refactor, story frontend data, permadeath and game over, admin tool and admin messages, crowdfunding and licenses, AWS logs table | Draft | [V1](documentation_v1/Roadmap.md) |
| V2 | gamma | A living world | Steam SSO, campaigns and global registry, advanced analytics, timed missions, silent events and warehouse, NPCs, entities, open world, noise and stealth, user progression | Draft | [V2](documentation_v2/Roadmap.md) |
| V3 | delta | Everywhere | Android app (online only), Steam app, Debian package, offline backend, sync, performance, free actions | Draft | [V3](documentation_v3/Roadmap.md) |
| V4 | epsilon | Multiplayer | Realtime channel, lobby, multiplayer turns, timeouts, anti-stall, group movement, multiplayer UI | Draft | [V4](documentation_v4/Roadmap.md) |
| V5 | zeta | Advanced multiplayer | Trade, chat and moderation, notifications, player signals, voting, group rituals, spectator mode | Draft | [V5](documentation_v5/Roadmap.md) |
| V6 | eta | Infrastructure | Kubernetes, disaster recovery, Azure (Docker images), Cloudflare, monitoring, security audit | Draft | [V6](documentation_v6/Roadmap.md) |

## 2. Principles

- Single-player first: multiplayer comes last and may slip to later versions (V20 or beyond).
- No combat system before multiplayer ([Game Rules](./GameRules.md)).
- Three backends (Java, Python, AWS) stay aligned; the alpha runs on AWS.
- Android is online only; offline play (Steam, Debian) comes with the V3 sync system, where the
  last played match always wins.
- Accounts use SSO only (Google in V1, Steam in V2): no email/password, no stored emails.


# Version Control
- **Document Version**: 0.40.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.40.0 | First global roadmap with all planned versions | September 25, 2026 |

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
