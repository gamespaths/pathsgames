# Paths Games V0 - Step 20: Game Website — First Run & Match End Flow
 

## 0.20.1 — Player-driven match completion (`PATCH /api/match/{uuidMatch}/end/{uuidEvent}`)

### Context: who today can set a match as complete

Before 0.20.1 the only ways to mark a match as terminal (`ENDED` / `GAMEOVER`)
were **admin operations**:

| Action | Endpoint | Status | Caller |
|--------|----------|--------|--------|
| Stop a match | `POST /api/admin/matches/{uuid}/stop` | `ENDED` | Admin token |
| Force any status | `PUT /api/admin/matches/{uuid}` `{"status":"GAMEOVER"}` | any | Admin token |
| Pause a match | `POST /api/admin/matches/{uuid}/pause` | `PAUSED` | Admin token |
| Resume a match | `POST /api/admin/matches/{uuid}/resume` | `RUNNING` | Admin token |

No gameplay engine existed: only admins could complete a match. 0.20.1 adds
the **first player-driven** way to complete a match.

### Contract

```
PATCH /api/match/{uuidMatch}/end/{uuidEvent}
Authorization: Bearer <player access token>

200 → { "status": "ENDED", "uuid": "<match-uuid>" }     (match owned by caller, event = end-game)
401 → missing / invalid Bearer token
404 → match not found OR caller is not the owner       (MATCH_NOT_FOUND)
406 → event is not the configured end-game event       (EVENT_NOT_END_GAME)
```

### Rules

- The authenticated user must be the **match creator**; ownership failures
  return `404` (not `403`) to avoid leaking that the match exists.
- The supplied event uuid is resolved via `StoryReadPort.findEventByStoryIdAndUuid`
  against the match's story. When the resolved event id equals the story's
  `id_event_end_game` (retrieved via `StoryReadPort.findStoryById`), the match
  status is set to `ENDED` via the same persistence call used by the admin stop
  endpoint (`persistencePort.updateMatchFields(uuidMatch, ENDED, null)`).
- **`idEventEndGame` is private**: it is **never** returned in any API
  response (request, success, 404, or 406). This applies to all four
  backends and is asserted by Robot E2E.

### Where the code lives

| Layer | Java | Python | PHP | AWS Lambda |
|-------|------|--------|-----|------------|
| Port (interface) | [MatchCommandPort.java](code/backend/java/core/src/main/java/games/paths/core/port/match/MatchCommandPort.java) | [match_ports.py](code/backend/python/app/core/ports/match/match_ports.py) | [MatchCommandPort.php](code/backend/php/src/Core/Port/Matches/MatchCommandPort.php) | inline (`handler.py`) |
| Service | [MatchCommandService.java](code/backend/java/core/src/main/java/games/paths/core/service/match/MatchCommandService.java) | [match_command_service.py](code/backend/python/app/core/services/match/match_command_service.py) | [MatchCommandService.php](code/backend/php/src/Core/Service/Matches/MatchCommandService.php) | [match/handler.py](code/backend/aws/lambda/match/handler.py) `_end_match` |
| Controller / route | [MatchController.java](code/backend/java/adapter-rest/src/main/java/games/paths/adapters/rest/controller/match/MatchController.java) `endMatch()` | [match_controller.py](code/backend/python/app/adapters/rest/match/match_controller.py) `end_match()` | [MatchController.php](code/backend/php/src/Adapter/Rest/Matches/MatchController.php) `endMatch()` + `public/index.php` PATCH route | [match.yaml](code/backend/aws/template/match.yaml) `EndMatchRoute` + dispatcher in `handler.py` |
| Story-event lookup | `StoryReadPort.findEventByStoryIdAndUuid` + new `findStoryById` | `StoryMatchReadPort.find_event_by_story_id_and_uuid` + `find_story_by_id` | `StoryMatchReadPort::findEventByStoryIdAndUuid` + `findStoryById` | DynamoDB `STORY#{uuid}` item embeds `events[]` and `idEventEndGame` |
| OpenAPI spec | [v0.20.1-match-end-api.yaml](code/backend/java/adapter-rest/src/main/resources/openapi/v0.20.1-match-end-api.yaml) | (shared) | (shared) | (shared) |

### Tests

- **Java**: new `PlayerEndMatch` nested test class in `MatchCommandServiceTest`
  (7 cases: blank inputs, unknown match, caller not owner, unknown caller,
  story missing end event, wrong event, success) + 4 controller cases in
  `MatchControllerTest` (401, 200, 406, 404). Full suite: core → 738 passed;
  adapter-rest → BUILD SUCCESS.
- **Python**: 8 service tests in `test_match_command_service.py` + 4 controller
  tests in `test_match_controller.py`. Full suite: 393 passed.
- **PHP**: 7 service tests + 4 controller tests via PHPUnit. Full suite: 453 passed.
- **AWS Lambda**: 6 new handler tests in `test_match_handler.py` (401, 404 match
  unknown, 404 wrong owner, 406 story missing end event, 406 wrong event, 200
  success). Full suite: 184 passed.
- **Robot E2E** (`code/tests/robot/tests/19_match/match_end.robot`): 5 cases
  covering 401 / 404 / 406, ownership boundary, and the privacy assertion that
  no response leaks `idEventEndGame`.

### Future work (roadmap items 30–45)

The new endpoint is the first hook for a real gameplay engine. The natural
next steps are:

1. Auto-end a match server-side when `MaxConsecutivePassBeforeGameover` is
   exceeded — sets status to `GAMEOVER` rather than `ENDED`.
2. Surface the player-driven completion in the `react-game` frontend (out of
   scope for 0.20.1 by request).
3. Reflect completion via WebSocket so other connected clients of the same
   match (multi-player) see the state change in real time.


## Version Control
- Created with AI assistance (Claude Sonnet 4.6 via Claude Code).
  - i wanna add Turnstile anti-robot on react-game proeject
  - ciao, new update i added "Cloudflare Turnstile anti-bot" on react-game project but now i wanna validate token on serve side , let's go!
    - change others backend (python, php and aws lambda)
    - add robot test too if it's possibile, create "code/tests/robot/tests/20_website"
- check all project and all documentation files, check where and who to set complete a match.
  - now i wanna create an new api PATCH `/match/{uuid_match}/end/{uuid_event}`: to complete the match (set on ENDED state) if event is the "idEventEndGame" of story of match (never return idEventEndGame values on API), if event is not the idEventEndGame return "406 Not Acceptable". use "0.20.1" version, we are on step 20. please develop all backend (java, php,python, aws lambda), remember to add robot tests. In this session don't change frontend-react projects.
- read documentation_v0/Step20_GameWebSiteFirstRun.md and let's go to import match end into react-game project and GameBook components: refactor LocationCard to use GameCard component, if there are not any location into story object, show story big card. refactor PlayerStats to use BonusBadgeList. refactor NeighborRow and ActionsRow to use GameCard little. If actions has "endGame"="true" show button "End game" to call "end game api" and hide GameBook and show EndGameBook with on left story card and on right endGameCard from gameData.json and a button "close" to restart from home page. 
  - into GameBook refactor NeighborRow and ActionsRow to a SelectionView


- **Document Version**: 0.20.2

| Version | Description | Date |
|---------|-------------|------|
| 0.20.0 | First-run flow documentation + Cloudflare Turnstile anti-bot | May 21, 2026 |
| 0.20.0 | Hybrid Cloudflare architecture: pathsgames.com → CF Pages, paths.games → AWS invariato | May 25, 2026 |
| 0.20.0 | Back pathsgames.com on AWS and define test.paths.games environment | May 26, 2026 |
| 0.20.1 | Player-driven match completion: `PATCH /api/match/{uuidMatch}/end/{uuidEvent}` | May 27, 2026 |
| 0.20.2 | Complete the match in react-game frontend | May 27, 2026 |

- **Last Updated**: May 27, 2026
- **Status**: Complete

# < Paths Games />
All source code and information in this repository are the result of careful and patient development work by the developer team, who has made every effort to verify their correctness to the greatest extent possible. Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website.

## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull;
Public projects
<a href="https://www.gnu.org/licenses/gpl-3.0" valign="middle"><img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*

The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.

Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).
