# Replit

Running a demo of Paths Games on Replit: Python backend plus react-game only.

## 1. What Replit is

Replit (replit.com) is a browser-based cloud IDE with hosting. A workspace has a file editor,
Shell, Secrets, Git pane, Run button with Webview, and "Publish" (deployments, type Autoscale).
Third-party pricing trackers report the free Starter plan was removed from the pricing page in
September 2026 (entry tier is now Core, about $20/month); the status of existing free accounts is
unknown, check replit.com/pricing. Free tier limits were roughly 1 vCPU, 2 GiB RAM, about 2 GiB
storage and 1 published app (link expires after 30 days).

## 2. What runs on Replit

- Python backend (SQLite) and react-game only.
- NOT the Java backend: Replit detects `pom.xml`, applies a Java template that runs
  `java -classpath .:target/dependency/* Main` and fails with `ClassNotFoundException: Main` in a
  crash loop; Maven and Spring Boot are also too heavy for 2 GiB.
- NOT AWS, NOT Robot tests, NOT the website. react-admin is optional and not recommended (RAM).

## 3. Setup from a repo import

1. replit.com -> Create -> Import from GitHub -> repo `pathsgames`, branch `develop`. Skip the
   automatic setup / Agent: it consumes credits and may change code and commit.
2. Secrets tool (padlock): `JWT_SECRET` (random, at least 32 chars), `ENV=development`,
   `DB_PATH=database.sqlite`. Never copy `.env`. Leave `HOST` at the default `127.0.0.1`, so the
   backend port 8042 and the admin port 8044 stay internal (the admin port must never be exposed).
3. Shell:
   ```bash
   cd code/backend/python && pip install -r requirements.txt
   cd ../../frontend/react-game && npm install
   ```
   Replit installs packages through a package firewall (`package-firewall.replit.internal`) that
   returns HTTP 403 for versions with known vulnerabilities: on a 403, bump only that pin.
4. Edit the `server` block of `code/frontend/react-game/vite.config.js` (Vite 7 blocks unknown
   hosts):
   ```js
   server: {
     host: '0.0.0.0',
     port: 5174,
     allowedHosts: ['.replit.dev', '.replit.app', '.repl.co'],
     proxy: {
       '/api': {
         target: 'http://localhost:8042',
         changeOrigin: true,
       },
     },
   },
   ```
   `.replit.dev` is the workspace URL, `.replit.app` the published URL (without it: "Blocked
   request. This host (...replit.app) is not allowed"). `vite preview` inherits proxy and
   `allowedHosts` from `server`. The browser talks only to Vite, which proxies `/api` to the
   internal backend: same origin, no CORS issues.
5. Create `.replit` at the repo root (hidden file: file tree menu -> Show hidden files; remove any
   java-graalvm module or Java run lines):
   ```toml
   modules = ["python-3.12", "nodejs-20"]

   run = "cd code/backend/python && PORT=8042 python3 -m app.launcher & cd code/frontend/react-game && VITE_API_URL=https://$REPLIT_DEV_DOMAIN npm run dev"

   [deployment]
   build = ["sh", "-c", "pip install -r code/backend/python/requirements.txt && cd code/frontend/react-game && npm ci && VITE_API_URL=https://pathsgames--alnao84.replit.app npm run build"]
   run = ["sh", "-c", "cd code/backend/python && PORT=8042 python3 -m app.launcher & cd code/frontend/react-game && npx vite preview --host 0.0.0.0 --port 5174"]

   [[ports]]
   localPort = 5174
   externalPort = 80
   ```
   `VITE_API_URL` is needed because react-game tracks only `.env.example`: on Replit it would be
   empty and the game falls back to `http://localhost:8042`, so the browser would call the
   visitor's own localhost. Vite reads `VITE_*` from the process environment; pointing it to the
   page's own origin works because Vite (dev and `vite preview`) proxies `/api` to the backend on
   8042. `PORT=8042` is forced because Replit sets `PORT` to the published port (5174) and the
   Python settings read it: without the override the backend binds 5174, already used by Vite,
   and crashes. `VITE_DEFAULT_SERVERS` can stay unset. `$REPLIT_DEV_DOMAIN` is the workspace
   `*.replit.dev` domain (check with `echo $REPLIT_DEV_DOMAIN`). For Publish the URL is baked in
   at build time: put your own `https://<repl>--<user>.replit.app` in the build command and
   re-Publish after changing it.
   Expose only 5174; refuse if Replit offers to expose 8044.

## 4. Run (workspace)

Press Run: the game opens in the Webview. Check the backend from the Shell:

```bash
curl localhost:8042/api/echo/status
```

## 5. Publish

Publish / Deployments -> type Autoscale (one external port) -> check that Deployment Secrets
contain `JWT_SECRET` and `ENV` -> Publish. The build step compiles react-game; the app is at
`https://<repl>--<user>.replit.app`. Always test with Run first. The health check hits `/` and
must get 200.

## 6. Caveats

- Edits made on Replit live only in the Replit copy until committed and pushed from the Git pane
  (then `git pull` locally).
- The published filesystem is not persistent: SQLite resets on every redeploy.
- No `database.sqlite` is tracked and the Python backend has no startup seed (the seed call is
  commented in `code/backend/python/app/adapters/persistence/database.py`), so the published app
  starts with no stories; import goes through the admin API on 8044, which is intentionally not
  exposed.
- If the browser still calls `localhost:8042`, clear the site data: the game remembers the chosen
  server in localStorage key `pg_game_server`.
- All `/api/*` return 500 and Vite logs `http proxy error ... ECONNREFUSED 127.0.0.1:8042`: the
  backend is not running (it starts in background with `&`, so the site still loads). Search
  Deployments -> Logs for the Python traceback: `Errno 98 address already in use` means the `PORT`
  override is missing; a database error usually means `ENV` is not exactly `development` in the
  Secrets (any other value switches to PostgreSQL on localhost:5432).
- `*.replit.dev` URLs are reachable by anyone with the link: use no real data.

# Version Control
- **Document Version**: 0.42.0

  | Version | Description | Date |
  |---------|-------------|------|
  | 0.42.0 | Guide to run a demo on Replit | October 9, 2026 |

- **Last Updated**: October 9, 2026 (v0.42.0)

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
