#!/usr/bin/env python3
"""Records the Paths Games tutorial as a 1080x1920 MP4 for TikTok and Instagram Reels.
Usage, options and requirements: see README.md in this folder."""
import argparse
import base64
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

URL_DEFAULT = os.environ.get("PATHS_GAMES_URL", "http://localhost:5174")
OUTPUT_DIR_DEFAULT = Path.home() / "Videos" / "paths"
# Full 9:16 frame in CSS px; below 768px the site uses its mobile layout.
WIDTH, HEIGHT = 405, 720
BAND = 50                                  # black band top and bottom (CSS px), kept free for the social UI
VIEWPORT = (WIDTH, HEIGHT - 2 * BAND)      # the page sits between the two bands
FINAL = (1080, 1920)
SCALE = FINAL[0] / WIDTH                   # device scale factor: frames are captured at final resolution
BAND_FINAL = 2 * round(BAND * SCALE / 2)   # even, as yuv420p needs
FPS = 30
JPEG_QUALITY = 92
CAPTCHA_WAIT_MS = 180_000                  # max time to tick the captcha by hand
CUT_MARGIN_S = 0.6                         # waiting kept on each side of a cut, so the jump looks natural
CUT_MIN_S = 2 * CUT_MARGIN_S + 0.5         # shorter waits stay in the video
CAPTION_MS = 5000                          # how long a caption stays on screen
TIP_MS = 3500                              # tip on a button that is only pointed at
TAP_TIP_MS = 2500                          # tip on a button before the tap
SCROLL_MS = 1800                           # duration of every scroll animation
MOVES = ("north", "east", "north")         # tutorial map: the north room opens only to the east

LOCALE = "en-US"   # browser language: the site follows it
# Video texts: "c_" captions (top, page dimmed), "t_" tips (next to the highlighted button)
TEXTS = {
    "c_welcome": "Welcome to Paths Games: a gamebook you play in your browser",
    "t_tutorial": "Tap here to start the tutorial",
    "c_config": "Here you choose class, character, traits and difficulty",
    "t_start": "Then tap Start",
    "t_accept": "Accept the terms",
    "t_accepted": "The terms are already accepted",
    "t_launch": "And start the match!",
    "c_match": "The match has begun: this is your book",
    "t_map": "Here is the map",
    "t_missions": "the missions",
    "t_backpack": "and the backpack",
    "t_action": "Each place offers actions: open one",
    "t_confirm_action": "Tap Execute to try it",
    "t_choice": "An action can ask you to choose",
    "t_continue": "Read the result and go on",
    "t_back": "Back to the board",
    "t_move": "Tap Move to choose where to go",
    "t_confirm_move": "Moving costs energy: tap Move to set off",
    "c_arrival": "You have reached a new place!",
    "t_move_north": "Keep heading north",
    "t_move_east": "Now go east",
    "t_move_south": "Now go south",
    "t_move_west": "Now go west",
    "t_confirm_next": "Tap Move again",
    "c_end": "Have a good journey, adventurer!",
}

# Fake cursor, tap ripple, tips and captions (the real cursor never shows in a screencast)
OVERLAY_JS = """
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    #pw-cursor { position: fixed; left: -50px; top: -50px; width: 20px; height: 20px;
      border-radius: 50%; background: rgba(255,60,60,.7); border: 2px solid #fff;
      pointer-events: none; z-index: 2147483647; transform: translate(-50%,-50%); }
    .pw-ripple { position: fixed; width: 56px; height: 56px; border-radius: 50%;
      border: 4px solid #ff3c3c; pointer-events: none; z-index: 2147483646;
      transform: translate(-50%,-50%) scale(0); animation: pw-ripple .7s ease-out forwards; }
    @keyframes pw-ripple { to { transform: translate(-50%,-50%) scale(1.6); opacity: 0; } }
    /* dimmed page; with a target only its box stays lit (hole made by a huge box-shadow) */
    .pw-modal { position: fixed; pointer-events: none; z-index: 2147483640; }
    .pw-backdrop { inset: 0; background: rgba(0,0,0,.65); }
    .pw-spot { border-radius: 12px;
      box-shadow: 0 0 0 3px #f0c75e, 0 0 18px 6px rgba(240,199,94,.6), 0 0 0 200vmax rgba(0,0,0,.65); }
    .pw-tip, .pw-caption { position: fixed; background: #a8780a; color: #1e1200;
      border: 2px solid #f0c75e; font-family: sans-serif; font-weight: bold;
      box-shadow: 0 4px 14px rgba(0,0,0,.6); pointer-events: none; z-index: 2147483645;
      text-align: center; line-height: 1.25; box-sizing: border-box; }
    .pw-tip { padding: 8px 14px; border-radius: 10px; font-size: 20px;
      max-width: calc(100vw - 24px); }
    /* top of the screen: TikTok and Instagram put their buttons at the bottom and right */
    .pw-caption { left: 50%; top: 13%; transform: translateX(-50%); padding: 12px 18px;
      border-radius: 12px; font-size: 22px; width: calc(100vw - 48px); }
    .pw-modal, .pw-tip, .pw-caption { opacity: 0; transition: opacity .3s; }
    .pw-on { opacity: 1; }
  `;
  document.head.appendChild(style);
  const c = document.createElement('div');
  c.id = 'pw-cursor';
  document.body.appendChild(c);
  document.addEventListener('mousemove', e => {
    c.style.left = e.clientX + 'px';
    c.style.top = e.clientY + 'px';
  }, true);
  document.addEventListener('mousedown', e => {
    const r = document.createElement('div');
    r.className = 'pw-ripple';
    r.style.left = e.clientX + 'px';
    r.style.top = e.clientY + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 800);
  }, true);
});

// b = box of the button to highlight (tip next to it), null = caption on the dimmed page
window.__pw = {
  open(b, text) {
    this.close(true);
    const back = document.createElement('div');
    const l = document.createElement('div');
    l.textContent = text;
    if (b) {
      const p = 8;
      back.className = 'pw-modal pw-spot';
      Object.assign(back.style, { left: (b.x - p) + 'px', top: (b.y - p) + 'px',
        width: (b.width + 2 * p) + 'px', height: (b.height + 2 * p) + 'px' });
      l.className = 'pw-tip';
    } else {
      back.className = 'pw-modal pw-backdrop';
      l.className = 'pw-caption';
    }
    document.body.append(back, l);
    if (b) {
      const W = window.innerWidth, H = window.innerHeight, gap = 18;
      const w = l.offsetWidth, h = l.offsetHeight;
      // above the button, below it when there is no room; centred horizontally
      const left = b.x + b.width / 2 - w / 2;
      const top = b.y - gap - h >= 12 ? b.y - gap - h : b.y + b.height + gap;
      l.style.left = Math.min(Math.max(12, left), W - w - 12) + 'px';
      l.style.top = Math.min(Math.max(12, top), H - h - 12) + 'px';
    }
    void l.offsetWidth;   // apply the initial state, so the fade-in runs
    back.classList.add('pw-on');
    l.classList.add('pw-on');
  },
  close(now) {
    document.querySelectorAll('.pw-modal, .pw-tip, .pw-caption').forEach(e => {
      if (now) e.remove();
      else { e.classList.remove('pw-on'); setTimeout(() => e.remove(), 300); }
    });
  },
};
"""

# Eased scroll of the nearest scrollable box (or the page) to the element, in ms milliseconds
SCROLL_JS = """
(e, [block, ms]) => new Promise(done => {
  let box = e.parentElement;
  while (box && !(/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight))
    box = box.parentElement;
  const view = box ? box.getBoundingClientRect() : { top: 0, height: window.innerHeight };
  box = box || document.scrollingElement;
  const r = e.getBoundingClientRect();
  const offset = block === 'start' ? r.top - view.top : r.top - view.top - (view.height - r.height) / 2;
  const from = box.scrollTop;
  const to = Math.max(0, Math.min(from + offset, box.scrollHeight - box.clientHeight));
  if (Math.abs(to - from) < 4) { e.scrollIntoView({ block: 'nearest' }); return done(); }
  const behavior = box.style.scrollBehavior;
  box.style.scrollBehavior = 'auto';   // a CSS smooth scroll would fight every step
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    box.scrollTop = from + (to - from) * (k < .5 ? 2 * k * k : 1 - (2 - 2 * k) ** 2 / 2);
    if (k < 1) return requestAnimationFrame(step);
    box.style.scrollBehavior = behavior;
    e.scrollIntoView({ block: 'nearest' });   // outer boxes too, when the element sits in nested ones
    done();
  };
  requestAnimationFrame(step);
})
"""


class Screencast:
    """Chrome screencast (CDP): one JPEG per painted frame, with its own timestamp."""

    def __init__(self, context, page, frames_dir):
        self.cdp = context.new_cdp_session(page)
        self.dir = frames_dir
        self.frames = []   # [(epoch_sec, path)]
        self.cdp.on("Page.screencastFrame", self._on_frame)

    def _on_frame(self, ev):
        path = self.dir / f"{len(self.frames):06d}.jpg"
        path.write_bytes(base64.b64decode(ev["data"]))
        self.frames.append((ev["metadata"].get("timestamp") or time.time(), path))
        try:
            self.cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
        except Exception:
            pass   # the session is closing

    def start(self):
        self.cdp.send("Page.startScreencast", {
            "format": "jpeg", "quality": JPEG_QUALITY, "everyNthFrame": 2,   # ~30 fps out of 60
            "maxWidth": FINAL[0], "maxHeight": FINAL[1] - 2 * BAND_FINAL})

    def stop(self):
        try:
            self.cdp.send("Page.stopScreencast")
        except Exception:
            pass   # the page is already gone
        return time.time()


class Director:
    """Drives the page and remembers the waits to cut from the video."""

    def __init__(self, page, texts):
        self.page = page
        self.t = texts
        self.start = time.time()   # same clock as the screencast timestamps
        self.cuts = []             # [(from_sec, to_sec)] epoch seconds

    def pause(self, ms):
        self.page.wait_for_timeout(ms)

    def wait_unrecorded(self, action, message, since=None):
        """Runs a long wait (captcha, loading) and marks it to be cut."""
        since = time.time() if since is None else since
        print(f"... {message}")
        action()
        until = time.time()
        if until - since > CUT_MIN_S:
            self.cuts.append((since + CUT_MARGIN_S, until - CUT_MARGIN_S))

    def _open(self, box, text):
        self.page.evaluate("([b, t]) => window.__pw.open(b, t)", [box, text])

    def _close(self):
        try:
            self.page.evaluate("() => window.__pw && window.__pw.close()")
        except Exception:
            pass   # the tap loaded a new page: the overlay is already gone
        self.pause(300)   # fade-out

    def caption(self, text, duration_ms=CAPTION_MS):
        """Caption at the top, page dimmed below."""
        self._open(None, text)
        self.pause(duration_ms)
        self._close()

    def scroll(self, locator, block="center"):
        """Slow scroll (SCROLL_MS) of the page, or of the book that scrolls on its own, to the element."""
        locator.evaluate(SCROLL_JS, [block, SCROLL_MS])
        self.pause(300)

    def _box(self, locator):
        locator.wait_for()
        self.scroll(locator)
        box = locator.bounding_box()
        return box, box["x"] + box["width"] / 2, box["y"] + box["height"] / 2

    def point(self, locator, text=None, pause_ms=TIP_MS):
        """Highlights the element with its tip and moves the cursor there, without tapping."""
        box, x, y = self._box(locator)
        if text:
            self._open(box, text)
        self.page.mouse.move(x, y, steps=30)
        self.pause(pause_ms)
        if text:
            self._close()

    def tap(self, locator, text=None, pause_ms=1500):
        """Highlights the element with its tip, moves the cursor there and taps."""
        box, x, y = self._box(locator)
        if text:
            self._open(box, text)
        self.page.mouse.move(x, y, steps=30)
        self.pause(TAP_TIP_MS if text else 700)
        self.page.mouse.click(x, y)
        if text:
            self._close()   # right away: the tap often changes page and the spot would stay behind
        self.pause(pause_ms)

    def by_id(self, test_id, within=""):
        # Only visible ones: the site also keeps the hidden desktop layout in the page.
        return self.page.locator(f'{within} [data-testid="{test_id}"]'.strip()).filter(visible=True).first

    def labelled(self, test_id):
        # Locked cards show an icon-only (i) button with the same id: keep the ones with a label.
        return (self.page.locator(f'[data-testid="{test_id}"]')
                .filter(has=self.page.locator(".gc-footer__btn-label")).filter(visible=True).first)

    def visible(self, locator, timeout_ms=1500):
        try:
            locator.wait_for(timeout=timeout_ms)
            return True
        except PWTimeout:
            return False

    def optional(self, name, step):
        """Runs a step that the story may not allow (locked, no energy): on failure the video goes on."""
        try:
            step()
        except Exception as e:
            print(f"!!! Skipping '{name}': {str(e).splitlines()[0]}")
            self.page.keyboard.press("Escape")   # closes a preview left open
            self.pause(500)

    def title(self):
        return self.page.locator("h1, h2").filter(visible=True).first


def script(d, url):
    """The tutorial steps: edit here to change the video."""
    page, t = d.page, d.t

    try:
        page.goto(url, wait_until="load")
    except Exception as e:
        raise RuntimeError(f"{url} does not answer: is the server running?") from e

    # Cookie banner (vanilla-cookieconsent): closed before the good part of the video
    try:
        page.locator('#cc-main button[data-role="necessary"]').click(timeout=5000)
    except PWTimeout:
        pass

    # Cloudflare Turnstile: the tutorial button is enabled only after the check
    tutorial = d.by_id("tutorial-btn")
    d.wait_unrecorded(
        lambda: page.wait_for_function(
            "() => { const b = document.querySelector('[data-testid=\"tutorial-btn\"]'); return b && !b.disabled }",
            timeout=CAPTCHA_WAIT_MS),
        "Waiting for the Cloudflare check: tick the box in the browser window if it shows up",
        since=d.start - CUT_MARGIN_S)   # also cuts the first load and the cookie banner
    d.pause(800)

    # 1. Home
    d.caption(t["c_welcome"])
    d.tap(tutorial, t["t_tutorial"], 2500)

    # 2. Configuration book (class, character, ...)
    start = d.by_id("book-start-action")
    start.wait_for(timeout=30_000)
    d.caption(t["c_config"], CAPTION_MS + 500)
    d.tap(start, t["t_start"], 2000)

    # 3. Match confirmation: terms (usually already accepted) and launch
    page.wait_for_url("**/start-match/**", timeout=30_000)
    terms = d.by_id("terms-select")
    terms.wait_for(timeout=10_000)
    if "gc-footer__btn--selected" in (terms.get_attribute("class") or ""):
        d.point(terms, t["t_accepted"])
    else:
        d.tap(terms, t["t_accept"], 1200)
    launch = d.by_id("match-start-action")   # a locked label until the second antibot check passes
    d.wait_unrecorded(
        lambda: launch.wait_for(timeout=CAPTCHA_WAIT_MS),
        "Waiting for the second antibot check (tick the box if it shows up)")
    d.tap(launch, t["t_launch"], 1000)

    # 4. Match creation and entry into the game
    game_map = d.by_id("bookmark-map")
    d.wait_unrecorded(
        lambda: (page.wait_for_url("**/play/**", timeout=120_000), game_map.wait_for(timeout=60_000)),
        "Waiting for the match to be created")
    d.pause(1000)
    d.scroll(d.title(), "start")
    d.caption(t["c_match"])

    # 5. Tour of the game book
    d.point(game_map, t["t_map"])
    d.point(d.by_id("bookmark-missions"), t["t_missions"])
    d.point(d.by_id("bookmark-backpack"), t["t_backpack"])

    # 6. One action of the starting place: its preview, "Execute", then the result pages
    d.optional("action", lambda: run_action(d))

    # 7. Moves: the card's "Move" opens the place preview, the preview's "Move" really moves
    for i, direction in enumerate(MOVES):
        d.optional(f"move {direction}", lambda i=i, direction=direction: run_move(d, direction, first=i == 0))

    d.caption(t["c_end"])


def run_action(d):
    t = d.t
    d.tap(d.labelled("action-info"), t["t_action"], 2000)
    d.tap(d.by_id("action-action", within="#cardPreviewModal"), t["t_confirm_action"], 2500)
    follow_results(d)


def run_move(d, direction, first):
    t = d.t
    d.tap(d.labelled(f"movement-{direction}-info"), t["t_move"] if first else t[f"t_move_{direction}"], 2000)
    d.tap(d.by_id(f"movement-{direction}-action", within="#cardPreviewModal"),
          t["t_confirm_move"] if first else t["t_confirm_next"], 2500)
    follow_results(d)
    d.scroll(d.title(), "start")
    if first:
        d.caption(t["c_arrival"])


def follow_results(d, max_steps=6):
    """After an action or a move: picks the first choice, pages forward, closes the result page."""
    t = d.t
    for _ in range(max_steps):
        d.pause(1200)   # the board reloads
        choice = d.by_id("choice-select")
        forward = d.by_id("page-forward")
        back = d.by_id("page-back")
        if d.visible(choice, 800):
            d.tap(choice, t["t_choice"], 2000)
        elif d.visible(forward, 800):
            d.tap(forward, t["t_continue"], 2000)
        elif d.visible(back, 800):
            d.tap(back, t["t_back"], 1500)
        else:
            return


def frame_durations(times, end, cuts):
    """Seconds each frame stays on screen in the final video: until the next one, minus the cuts."""
    out = []
    for i, start in enumerate(times):
        stop = times[i + 1] if i + 1 < len(times) else end
        cut = sum(max(0.0, min(stop, b) - max(start, a)) for a, b in cuts)
        out.append(max(0.0, stop - start - cut))
    return out


def concat_list(frames, end, cuts):
    """ffconcat list of the frames still visible after the cuts (the last file is repeated, as ffmpeg wants)."""
    lines = ["ffconcat version 1.0"]
    kept = None
    for (_, path), dur in zip(frames, frame_durations([t for t, _ in frames], end, cuts)):
        if dur > 1e-4:
            lines += [f"file '{path.name}'", f"duration {dur:.4f}"]
            kept = path
    if kept:
        lines.append(f"file '{kept.name}'")
    return "\n".join(lines) + "\n"


def ffmpeg_command(concat_file, mp4):
    """MP4 for TikTok/Reels: 1080x1920 with black bands, 30 fps, H.264 + silent audio track."""
    content_h = FINAL[1] - 2 * BAND_FINAL
    vf = (f"fps={FPS},scale={FINAL[0]}:{content_h}:flags=lanczos,"
          f"pad={FINAL[0]}:{FINAL[1]}:0:{BAND_FINAL}:black,setsar=1")
    return ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(concat_file),
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-vf", vf, "-map", "0:v", "-map", "1:a", "-shortest",
            "-c:v", "libx264", "-profile:v", "high", "-crf", "18", "-preset", "slow",
            "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(mp4)]


def build_video(frames, end, cuts, frames_dir, mp4):
    concat_file = frames_dir / "frames.ffconcat"
    concat_file.write_text(concat_list(frames, end, cuts))
    subprocess.run(ffmpeg_command(concat_file, mp4), check=True)


def main():
    parser = argparse.ArgumentParser(description="Records the Paths Games video tutorial")
    parser.add_argument("--url", default=URL_DEFAULT,
                        help=f"site to record (default: {URL_DEFAULT}, or the PATHS_GAMES_URL variable)")
    parser.add_argument("--out", type=Path, default=OUTPUT_DIR_DEFAULT,
                        help=f"output folder (default: {OUTPUT_DIR_DEFAULT})")
    parser.add_argument("--headless", action="store_true",
                        help="no browser window (only when the captcha passes by itself, e.g. Turnstile test keys)")
    args = parser.parse_args()
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found: install it first (e.g. sudo apt install ffmpeg)")

    args.out.mkdir(parents=True, exist_ok=True)
    name = time.strftime("tutorial_%Y%m%d_%H%M%S")
    frames_dir = args.out / f".{name}_frames"
    frames_dir.mkdir()
    print(f"Recording {args.url}")

    error, screen, director, end = None, None, None, time.time()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless)
        try:
            context = browser.new_context(
                viewport={"width": VIEWPORT[0], "height": VIEWPORT[1]}, device_scale_factor=SCALE,
                is_mobile=True, has_touch=True, locale=LOCALE)
            context.add_init_script(OVERLAY_JS)
            page = context.new_page()
            screen = Screencast(context, page, frames_dir)
            director = Director(page, TEXTS)
            screen.start()
            try:
                script(director, args.url)
            except Exception as e:
                error = e
                print(f"!!! Error while recording: {e}")
                try:
                    page.screenshot(path=str(args.out / f"{name}_error.png"))
                except Exception:
                    pass
            finally:
                end = screen.stop()
        finally:
            browser.close()

    if not screen or not screen.frames:
        shutil.rmtree(frames_dir, ignore_errors=True)
        sys.exit("No frame recorded")
    if director.cuts:
        print("Cuts (sec):", ", ".join(f"{a - director.start:.1f}-{b - director.start:.1f}" for a, b in director.cuts))

    mp4 = args.out / f"{name}{'_partial' if error else ''}.mp4"
    try:
        build_video(screen.frames, end, director.cuts, frames_dir, mp4)
    except subprocess.CalledProcessError as e:
        sys.exit(f"ffmpeg failed ({e.returncode}): frames kept in {frames_dir}")
    shutil.rmtree(frames_dir, ignore_errors=True)
    print(f"{'Partial video' if error else 'Video'}: {mp4}")
    if error:
        sys.exit(1)


if __name__ == "__main__":
    main()
