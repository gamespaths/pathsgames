# Paths Games V0 - Step 20: Game Website — First Run & Match Start Flow

This document describes the complete steps to migrate `pathsgames.com` on Cloudflare Cloud, `paths.games` remain into AWS Cloud.


## Step 20.1 — Hybrid Architecture: pathsgames.com on Cloudflare Pages

### Goal

Deploy the `react-game` frontend on **Cloudflare Pages** under `pathsgames.com`,  
keeping `paths.games` and the entire AWS stack **unchanged**.

```
pathsgames.com  ──► Cloudflare DNS ──► CF Pages (react-game SPA, built from GitHub)
                         │
                         ├── CF WAF free (OWASP, Bot Fight Mode)
                         ├── CF SSL (Universal, automatic)
                         ├── CF Analytics (free)
                         └── Turnstile widget
                                  │ calls API
                                  ▼
api-dev.paths.games ──► Route53 ──► API Gateway (HTTP v2) ──► Lambda ──► DynamoDB
                                         │
                                         └── CORS allowlist: pathsgames.com ✓

paths.games ──► Route53 (UNCHANGED) ──► CloudFront ──► S3 (code/website/html)
                                              │
                                              ├── ACM Certificate (paths.games only)
                                              ├── Security Headers (SSM-driven CSP)
                                              ├── WAF v2 (optional, enable_waf=true)
                                              └── Geo-block RU/BY/CN
```

**Key simplification**: `paths.games` and its entire AWS stack are left untouched.  
Only `pathsgames.com` migrates to Cloudflare Pages.

---

### PHASE 1 — Cloudflare Account Setup (prerequisites)

1. **Create a Cloudflare account** (if not already done) at `dash.cloudflare.com`
2. **Add only `pathsgames.com`** in Cloudflare → DNS → Add site
   - `paths.games` stays on Route53: **do not move it**
3. **Update the nameservers for `pathsgames.com`** at your registrar to point to Cloudflare NS
  - On route53 insert `joselyn.ns.cloudflare.com` and `nile.ns.cloudflare.com`
4. **Wait for DNS propagation** (up to 48h, usually < 1h with CF)

---

### PHASE 2 — Cloudflare DNS for pathsgames.com

5. **CF DNS for `pathsgames.com`**: CF Pages will automatically manage the records after Pages setup
   - `pathsgames.com` and `www.pathsgames.com` → point to the CF Pages project
   - SSL/TLS: CF Universal SSL is automatic and free — no ACM needed
6. **Verify**: `curl -sI https://pathsgames.com` should respond with a CF certificate

> ⚠️ `paths.games` stays on Route53 + CloudFront — **zero DNS changes there**

---

### PHASE 3 — Cloudflare Pages: deploy react-game on pathsgames.com

7. **CF Pages → Create a project → Connect to Git**

   | Setting | Value |
   |---|---|
   | Repository | `gamespaths/pathsgames` |
   | Production branch | `master` |
   | Framework preset | `Vite` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `code/frontend/react-game` *(no leading slash)* |
   | Deploy command | *(leave empty — CF Pages deploys automatically on git push)* |

   > ⚠️ `npx wrangler deploy` and `npx wrangler versions upload` are **Cloudflare Workers** commands — do NOT use them here. CF Pages has its own automatic deploy pipeline.  
   > If you need a manual CLI deploy (without git integration): `npx wrangler pages deploy dist --project-name=pathsgames-com`

8. **Environment Variables in CF Pages** (Settings → Environment variables):

   | Variable | Value |
   |---|---|
   | `VITE_GTM_ID` | `GTM-xxxxxxxx` |
   | `VITE_MATCH_START_DELAY` | `5` |
   | `VITE_CF_TURNSTILE_KEY` | `0xAAAAA` |
   | `VITE_DEFAULT_SERVERS` | `[{"label":"Local (8042)","url":"http://localhost:8042"},{"label":"api-dev (AWS)","url":"https://api-dev.paths.games/"}]` |

   > Note: `paths.games` does not appear as an API server — it is the static HTML site, not the API.

9. **Configure custom domain** in CF Pages → Custom domains → `pathsgames.com` and `www.pathsgames.com`
10. **Test the first deploy** by browsing `https://pathsgames.com`

---

### PHASE 4 — CORS: allowlist pathsgames.com in all backends

The react-game on `pathsgames.com` calls `api-dev.paths.games` — all backends  
must accept requests coming from the new origin.

11. **Java** — `ms-launcher/src/main/resources/application-prod.yml`:

    ```yaml
    game:
      auth:
        cors:
          allowed-origins:
            - https://paths.games
            - https://www.paths.games
            - https://pathsgames.com        # ← add
            - https://www.pathsgames.com    # ← add
    ```

12. **AWS Lambda** — `code/backend/aws/template.yaml`, `CorsAllowOrigins` parameter default value:  
    Append to the existing list:
    ```
    https://pathsgames.com,https://www.pathsgames.com
    ```

13. **Python** — `code/backend/python/.env.example`:  
    Document the new origins in `CORS_ALLOWED_ORIGINS`

14. **PHP** — `code/backend/php/.env.example`:  
    Same update to `CORS_ALLOWED_ORIGINS`

15. **Test CORS**:
    ```bash
    curl -H "Origin: https://pathsgames.com" -I https://api-dev.paths.games/api/echo/status
    # Must respond with: Access-Control-Allow-Origin: https://pathsgames.com
    ```

---

### PHASE 5 — react-game CSP: allowlist api-dev.paths.games

The frontend on `pathsgames.com` calls `api-dev.paths.games` — the CSP must allow it.  
The CSP on `paths.games` (CloudFront SSM-driven) **is not touched**.

16. Check that the react-game build has no hardcoded meta CSP tags blocking `api-dev.paths.games`
17. If needed, add **CF Pages Headers** via a `_headers` file in `code/frontend/react-game/public/`:

    ```
    /*
      Content-Security-Policy: default-src 'self'; connect-src 'self' https://api-dev.paths.games https://challenges.cloudflare.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data:
    ```

---

### PHASE 6 — Cloudflare WAF + Security for pathsgames.com (free)

18. **CF Security → WAF → Managed Rules**: enable `Cloudflare Managed Ruleset` (OWASP)
19. **CF Security → Bots**: enable **Bot Fight Mode** (free)
20. **CF → SSL/TLS**: set mode to `Full` for `pathsgames.com` (CF Pages = automatic HTTPS)
21. **CF Analytics**: enabled automatically — Dashboard → Analytics & Logs

---

### PHASE 6b — Smoke test: deploy a simple HTML page to verify CF Pages works

Before deploying the full react-game build, validate that Cloudflare Pages can serve your domain correctly with a minimal static page.

1. In CF Pages dashboard → **Create a project → Upload assets**
2. Create a minimal `index.html` locally:
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head><meta charset="UTF-8"><title>CF Pages test</title></head>
   <body>
     <h1>✅ Cloudflare Pages is working!</h1>
     <p>Domain: pathsgames.com — deploy test</p>
   </body>
   </html>
   ```
3. Drag-and-drop the file (or zip) into the CF Pages upload UI
4. CF assigns a preview URL like `https://xxx.pathsgames-com.pages.dev`
5. Browse to the preview URL — verify it loads correctly
6. Attach the custom domain `pathsgames.com` → Custom domains → verify it resolves


### PHASE 7 — Turnstile: server-side validation (security gap)

Currently the Turnstile token is generated on the frontend but **not verified by any backend**.

#### Current status

| Backend | Turnstile frontend | Turnstile server-side |
|---|---|---|
| Java | ✅ widget active | ❌ missing |
| AWS Lambda | ✅ widget active | ❌ missing |
| Python | ✅ widget active | ❌ missing |
| PHP | ✅ widget active | ❌ missing |

#### Steps

22. **Register `pathsgames.com` on Turnstile dashboard** → get site key + **secret key**
23. **Java backend** — `POST /api/matches` controller:

    ```java
    // Before creating the match, verify the CF token:
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create("https://challenges.cloudflare.com/turnstile/v0/siteverify"))
        .POST(HttpRequest.BodyPublishers.ofString(
            "secret=" + cfTurnstileSecret + "&response=" + cfToken))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .build();
    // if response.success == false → throw 400 Bad Request
    ```

24. **AWS Lambda** — `lambda/match/handler.py`, route `POST /api/matches`:

    ```python
    import urllib.request, json
    def verify_turnstile(token: str, secret: str) -> bool:
        data = f"secret={secret}&response={token}".encode()
        req = urllib.request.Request(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data=data, method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
        return result.get("success", False)
    ```

25. **Python backend** — match controller: same `verify_turnstile()` logic
26. **PHP backend** — match controller:

    ```php
    $response = file_get_contents(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        false,
        stream_context_create(['http' => [
            'method' => 'POST',
            'content' => http_build_query([
                'secret' => getenv('CF_TURNSTILE_SECRET'),
                'response' => $request->getParsedBody()['cf_token'] ?? ''
            ])
        ]])
    );
    if (!json_decode($response, true)['success']) {
        return $response->withStatus(400);
    }
    ```

27. **Add `CF_TURNSTILE_SECRET`** to:
    - GitHub Secrets (for pipeline)
    - `.env.example` of Java, Python, PHP, AWS with usage instructions
    - Local test value: secret `1x0000000000000000000000000000000AA` (always passes)

---

### PHASE 8 — GitHub Actions: CI for CF Pages

CF Pages deploys **automatically** on every push to `master` — no custom deploy pipeline needed.

28. Verify that the `sonarqube-react-game.yaml` workflow still works correctly
29. **Optional** — create `.github/workflows/react-game-ci.yml` for PR tests:

    ```yaml
    name: React Game CI
    on:
      pull_request:
        paths: ['code/frontend/react-game/**']
    jobs:
      test:
        runs-on: ubuntu-latest
        defaults:
          run:
            working-directory: code/frontend/react-game
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with:
              node-version: '20'
              cache: npm
              cache-dependency-path: code/frontend/react-game/package-lock.json
          - run: npm ci
          - run: npm run test:coverage
    ```

30. No S3 deploy pipeline needed for react-game

---

### PHASE 9 — AWS Infrastructure Cleanup (minimal, post-validation)

Since `paths.games` stays unchanged on AWS, the cleanup is **very limited**:

31. **`code/website/terraform-aws/cloudfront.tf`**: remove `pathsgames.com` and `www.pathsgames.com` from the `aliases`
32. **ACM Certificate** in `cloudfront.tf`: remove the SAN `*.pathsgames.com` — no longer needed
33. **Route 53**: delete the `pathsgames.com` hosted zone (saves ~$0.50/month) — only after CF DNS is live and tested
34. **`terraform apply`** to apply the CloudFront + ACM changes
35. `paths.games` CloudFront + S3: **DO NOT touch** — leave exactly as-is

---

### PHASE 10 — End-to-end Testing

36. **Full manual test**:

    | Test | Expected |
    |---|---|
    | `https://pathsgames.com` | Loads react-game ✓ |
    | Guest login → calls `api-dev.paths.games` | Correct CORS headers in Network tab ✓ |
    | Match creation with Turnstile widget | Token generated + validated server-side ✓ |
    | `https://paths.games` | Static HTML site unchanged ✓ |

37. **Robot Framework**: update `code/tests/robot/variables/dev.yaml` with URL `https://pathsgames.com`
38. **Verify `paths.games` is not broken**:
    ```bash
    curl -sI https://paths.games | grep -i content-security
    ```

---

### Priority summary

| Priority | Phases | Impact |
|---|---|---|
| 🔴 Immediately | 1→4 (CF Pages + CORS) | Only `pathsgames.com`, zero risk on `paths.games` |
| 🟡 Next | 5→7 (CSP + Turnstile server-side) | Backend code change, real security fix |
| 🟢 After validation | 8→10 (CI + Terraform cleanup) | Irreversible but low risk |

### Estimated final cost

| Component | Cost |
|---|---|
| `pathsgames.com` CF Pages | ~$0 (free tier) |
| `paths.games` CloudFront + S3 | ~$2–4/mo (unchanged) |
| API Gateway + Lambda + DynamoDB | ~$0–2/mo (pay-per-request) |
| **Totale** | **~$2–6/mo** (vs $8–12/mo con WAF AWS) |

---





## Version Control
- Created with AI assistance (Claude Sonnet 4.6 via Claude Code).
  - i wanna add Turnstile anti-robot on react-game proeject
  - ciao, new update i added "Cloudflare Turnstile anti-bot" on react-game project but now i wanna validate token on serve side , let's go!
    - change others backend (python, php and aws lambda)
    - add robot test too if it's possibile, create "code/tests/robot/tests/20_website"


- **Step**: 20
- **Document Version**: 0.20.0

| Version | Description | Date |
|---------|-------------|------|
| 0.20.0 | First-run flow documentation + Cloudflare Turnstile anti-bot | May 21, 2026 |
| 0.20.0 | Hybrid Cloudflare architecture: pathsgames.com → CF Pages, paths.games → AWS invariato | May 26, 2026 |




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
