# Paths Games video tutorial

`record_tutorial.py` opens Paths Games as a portrait smartphone, plays the start of the tutorial and
records it with a visible cursor, tap ripples, tips and captions. The result is an MP4 ready for
TikTok and Instagram Reels, without the captcha and loading waits.

Recorded path: home → "Play the tutorial" → configuration book → "Start" → terms (usually already
accepted) → match launch → Map / Missions / Backpack → one action of the starting place (with its
choices and result pages) → moves north, east, north (`MOVES`; on the tutorial map the north room
opens only to the east).

A step the story does not allow (action locked, not enough energy, no exit in that direction) is
skipped with a message and the video goes on.

## Requirements

- The repo venv with Playwright (`.venv` at the repo root) and its Chromium:
  `source .venv/bin/activate && pip install playwright && playwright install chromium`
- `ffmpeg` on the PATH (`sudo apt install ffmpeg`): the script checks it before recording.
- A running site: by default the local react-game dev server at `http://localhost:5174`, with the
  Java backend behind it. The script never starts servers.

## Usage

From the repo root:

```bash
source .venv/bin/activate
python code/website/recorder/record_tutorial.py                  # http://localhost:5174
python code/website/recorder/record_tutorial.py --headless       # no browser window
python code/website/recorder/record_tutorial.py --url https://test.paths.games
python code/website/recorder/record_tutorial.py --out /tmp/videos
```

`--url` can also come from the `PATHS_GAMES_URL` variable. Videos go to `~/Videos/paths/`
(`tutorial_<date>.mp4`). The video is in English: browser locale `en-US`, so the site is in
English too.

**Captcha.** With the Cloudflare Turnstile test keys in the local `.env`
(`TURNSTILE_SITE_KEY=1x00000000000000000000AA`, `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`)
the check always passes, so `--headless` runs with no manual step. With real keys, run with a
window and tick "Verify you are human" by hand: the script waits up to 3 minutes.

**Errors.** If a step fails, the script saves `<name>_error.png`, still builds the video recorded so
far as `<name>_partial.mp4` and exits with code 1. If ffmpeg fails, the frames stay in
`.<name>_frames/` inside the output folder.

## How it records

- Chrome screencast (CDP), not the Playwright video: one JPEG per painted frame, already at final
  resolution (device scale factor 1080/405), so the video is sharp.
- Waits (captcha, match creation) are cut using the frames' own timestamps; `CUT_MARGIN_S` seconds
  of waiting stay on each side of a cut.
- The site buttons are found by `data-testid` (`tutorial-btn`, `book-start-action`, `terms-select`,
  `match-start-action`, `bookmark-map|missions|backpack`, `action-info|action`,
  `movement-<direction>-info|action`, `choice-select`, `page-forward`, `page-back`), so the script
  does not depend on the button labels.
- Scrolls are eased animations of `SCROLL_MS` milliseconds, slower than the browser's smooth scroll.

## Video format

- Page: mobile viewport 405x620 CSS px, between two black bands of `BAND` = 50 CSS px (top and
  bottom, 134 px in the final video), kept free for the social app's name and comments.
- Final video: MP4 H.264 1080x1920 (9:16), 30 fps, silent AAC track (some apps prefer one).
- Captions sit at the top: TikTok and Instagram put their buttons at the bottom and on the right.

## Changing the video

- Steps: `script()`; route on the map: `MOVES`.
- Timings: `CAPTION_MS` (captions), `TIP_MS` (tips on pointed buttons), `TAP_TIP_MS` (tips before
  a tap), `SCROLL_MS` (scrolls).
- Tips and captions: `TEXTS`; browser language: `LOCALE`.
- Cursor, tip and caption style: CSS in `OVERLAY_JS`.
- Size, bands, cut margin: `WIDTH` / `HEIGHT` / `BAND` / `FINAL` / `CUT_MARGIN_S`.

Each run creates a new guest user and a new match on the recorded site.
