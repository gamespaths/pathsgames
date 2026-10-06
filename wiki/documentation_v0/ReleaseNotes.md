# Release notes — V0 alpha (0.42)

The first public release of Paths Games: a single-player web gamebook at
[paths.games](https://paths.games), served by the AWS backend stage `alpha`
([Step 42](./Step42_AlphaLaunch.md)). The in-game Devlog book (footer link or header badge)
points here from its V0 card.

## What you can do

- **Play as a guest**: no account, no email; an anonymous guest session starts with one click
  and is resumed on the same browser.
- **Pick a story** from the catalog and set up your adventure: difficulty, character, class and
  traits, with their starting bonuses.
- **Play a full single-player match** in the book interface: locations and the map, movement with
  its energy cost, events and choices with lasting consequences, items and the backpack, the
  registry, missions and their steps, experience to raise your stats, time, sleep and weather.
- **Pause and resume** any match from your matches list, replay finished stories, read the match
  log.
- **Two languages**: English and Italian, switchable at any time.
- **Tips** on the card pages (open by default on tutorial stories), credits for every story and
  image, and the Devlog with the version roadmap.
- **Privacy first**: only strictly necessary cookies unless you accept analytics; policies one
  click away (also as links: `?policy=privacy`, `?policy=cookies`, `?policy=terms`).

## Known limitations

- Guests only: accounts and Google sign-in arrive in V1 (beta). A guest lives in one browser:
  clearing its cookies loses access to the matches.
- Single-player only; multiplayer is planned from V4.
- A guest who never starts a match is removed after 60 days without access; guests with at least
  one match are kept.
- Anti-abuse limits: new guest sessions and new matches per IP address per hour and new matches
  per guest per day are capped; an anti-bot check (Cloudflare Turnstile) runs before playing.
- No combat system; the story catalog is small and grows by hand.
- Best on a desktop or tablet browser; the phone layout is a simplified stack of cards.
- This is an alpha: bugs are expected, fixes ship as `0.42.z` ([Hotfixes](./Hotfixes.md)).

## Feedback

Send bugs, ideas and impressions on Instagram, [@pathsgames](https://www.instagram.com/pathsgames/)
(also linked in the game footer); the code and its issues are on
[GitHub](https://github.com/gamespaths/pathsgames).

# Version Control
- **Document Version**: 0.42.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.42.0 | First release notes of the alpha | October 6, 2026 |

- **Last Updated**: October 6, 2026 (v0.42.0)

# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website

## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
