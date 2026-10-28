# Todo-list 1.10.0 — variabili, test e passi

Correzioni della 1.10.0: le richieste 1-4 (`knownAccount`, scritture AWS a blocchi, nuovi Robot,
sessioni) e la revisione di sicurezza (vulnerabilità Critical, High e Medium).
Per ogni punto: **Fatto** = cosa è cambiato, **Test** = cosa provare, **Atteso** = risultato atteso.

---

## 0. Variabili d'ambiente

Prima di tutto, una regola che vale per tutte le righe sotto: **Python** legge da solo il `.env` della root (pydantic).
**Java** invece vede solo le variabili davvero esportate: gli script `start_*` e `run_robot_*`
fanno `. .env` ma esportano solo alcune variabili (JWT_SECRET, rate limit). Per gli script AWS
(`aws_backend_deploy.sh`, `aws_backend_deploy_stage.sh`, `aws_create_policy_github_actions.sh`)
basta il `.env`; per la CI alpha servono le **GitHub Variables** del repository.

| Variabile | Dove | Chi la legge | Valore | Quando serve |
|---|---|---|---|---|
| `TRUSTED_PROXIES` | `.env` (Python); variabile esportata (Java) | rate limit per IP di Java e Python | **vuoto** (default) | Solo se un backend Java/Python sta dietro un proxy (nginx, ALB, Cloudflare): CIDR del proxy, es. `10.0.0.0/8,172.16.0.0/12`. Vuoto = `X-Forwarded-For` ignorato e conta l'IP vero della connessione. In locale e sugli EC2 di oggi resta vuoto |
| `AWS_TEST_LAMBDA_ALLOW_MOCK_ACCESS` | `.env` | `code/scripts/test/aws/aws_backend_deploy.sh` | **`false`** (default) | `true` solo su uno stack test privato con `AWS_TEST_LAMBDA_GOOGLE_ENABLED=false`, altrimenti lo script si ferma con errore. Prima era sempre `true` |
| `AWS_TEST_APIGW_CORS_ORIGINS` | `.env` (esiste già) | SAM test e, da 1.10.0, gli script EC2 Python (`start.sh`, `redeploy.sh`) | lista separata da virgole, es. `http://localhost:5174,https://test.paths.games` | Deve contenere **ogni origine** da cui il gioco chiama l'EC2 Python, altrimenti il browser blocca il refresh. Se è vuota, gli EC2 usano `*` **senza credenziali**: i cookie non funzionano |
| `AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN` | `.env` **e** GitHub Variable con lo stesso nome | `aws_backend_deploy_stage.sh` → parametro SAM `PermissionsBoundaryArn` | `arn:aws:iam::<ACCOUNT_ID>:policy/paths-games-alpha-lambda-boundary` | Solo durante il rollout della boundary (punto 13). Vuoto = nessuna boundary, tutto come prima |
| `EXPECTED_SAME_SITE` (variabile Robot, non `.env`) | `--variable EXPECTED_SAME_SITE:None` sulla riga `robot` | `session_hardening.robot` | `Lax` in locale, `None` su AWS test | Facoltativa: senza, il test accetta qualunque SameSite valido. Con il valore controlla che sia quello configurato |

Non serve altro per far partire nulla: con i default (tutto vuoto o `false`) dev, test e alpha funzionano.

Due variabili già esistenti che fanno fallire i Robot su AWS test (visto nel run del 27/10):

| Variabile | Problema | Cosa fare |
|---|---|---|
| `AWS_TEST_LAMBDA_TURNSTILE_SECRET_KEY` | vale la chiave di prova Cloudflare `1x0000…AA` che **accetta sempre**: ogni token passa e i 2 test Turnstile si aspettano 400 | usa la chiave vera del widget di test, oppure `2x0000000000000000000000000000000AA` (rifiuta sempre: passa solo il token bypass dei Robot, ma dal sito non si crea più una partita), poi rideploy test |
| `AWS_TEST_LAMBDA_MAX_SESSIONS_PER_USER` | vale `3`; il test dei 13 login assumeva 12 | nessuna: da 1.10.0 `run_robot_with_aws_serverless.sh` passa il valore a Robot (`MAX_SESSIONS`), insieme a `EXPECTED_SAME_SITE` da `AWS_TEST_LAMBDA_COOKIE_SAME_SITE` |

> Nota Python Docker: l'immagine ora parte con `ENV=production`. Gli EC2 di test passano già
> `ENV=test` e un `JWT_SECRET` vero, quindi non cambia nulla. Se lanci l'immagine a mano, passa
> `-e ENV=development -e JWT_SECRET=...` oppure parte in modalità produzione (PostgreSQL, segreti obbligatori).

---

## 1. Passi da fare, in ordine

- [ ] **1. `.env`**: confronta con `.env.example` le 3 righe nuove (`TRUSTED_PROXIES`,
  `AWS_TEST_LAMBDA_ALLOW_MOCK_ACCESS`, `AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN`). Lasciale vuote
  o a `false`. Controlla che `AWS_TEST_APIGW_CORS_ORIGINS` contenga le origini del gioco di test.
- [ ] **2. Unit test** (già verdi, da rilanciare solo se cambi qualcosa):
  - `cd code/backend/java && mvn test`
  - `source .venv/bin/activate && cd code/backend/python && pytest`
  - `source .venv/bin/activate && cd code/backend/aws && pytest`
  - `cd code/frontend/react-game && npx vitest run`
- [ ] **3. Robot in locale**, uno alla volta (le suite nuove partono da sole, gli script girano `tests_v*/`):
  - `code/scripts/dev/run_robots/run_robot_with_local_java.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_java_postgres.sh`
  - `code/scripts/dev/run_robots/run_robot_with_local_python.sh`
  - `code/scripts/dev/run_robots/run_robot_with_aws_local.sh`
  - `ROBOT_RATE_LIMITS=1 code/scripts/dev/run_robots/run_robot_with_local_java.sh` (rate limit: ora conta l'IP vero)
- [ ] **4. Deploy dello stack AWS test**: `code/scripts/test/aws/aws_backend_deploy.sh`.
  Da qui in poi lo stack test usa JWT veri al posto dei token `MOCK_ACCESS_`.
- [ ] **5. Robot su AWS test**: `code/scripts/dev/run_robots/run_robot_with_aws_serverless.sh`.
  Il report aws-local del 23/10 era precedente al fix 1.8.0: questa è la prima prova reale di 08, 09 e 12.
- [ ] **6. EC2 Python di test** (se lo usi): `code/scripts/test/build_docker_python_test_and_push.sh`,
  poi `code/scripts/test/aws_ec2_with_python_docker/redeploy.sh`.
- [ ] **7. Test manuali** della sezione 3.
- [ ] **8. Rollout della permissions boundary** (punto 13): solo quando 1-7 sono verdi.
- [ ] **9. Documentazione**: `/doc-update` (sezioni "Fixes (1.10.0)" di Step 8, 10 e 12, `Security.md`,
  `.claude/docs/robot-suites.md`, `Environments.md` per le variabili nuove).

---

## 2. Test automatici nuovi (Robot)

- [ ] **A. `tests_v1/08_match_concurrency/match_concurrency_writes.robot`** (7 test, storia propria `story_concurrency.json`)
  - Fatto: `STALE_MATCH` su execute-event, select-choice, spostamento, use-item, drop-item, use-exp, end.
  - Atteso: per ognuno, con la versione vecchia 409 `STALE_MATCH` e partita invariata (versione, stato,
    giocatori, inventario); con quella attuale successo e versione nuova. Su tutti i backend.
- [ ] **B. `tests_v1/12_multi_device/session_hardening.robot`** (4 test)
  - Token girato da meno di 2 minuti → dopo "esci da tutti i dispositivi" il refresh risponde 401 `SESSION_REVOKED`.
  - Refresh dopo un ban: il token attivo risponde 401 `SESSION_REVOKED`, quello appena girato 403 `ACCOUNT_DISABLED`.
  - Sospensione: login rifiutato, poi `expire-suspension`, poi il login riesce e il dettaglio admin mostra stato 2.
  - Cookie `pathsgames.refreshToken` e `pathsgames.guestcookie`: HttpOnly, SameSite valido, Secure se SameSite=None.
  - Su AWS locale (token mock senza `iat`) il controllo sul token vecchio viene saltato: è normale.
- [ ] **C. `tests_v1/10_admin_users/admin_path_guard.robot`** (2 test)
  - Sulla URL pubblica, `/api/%61dmin/users`, `/api;x/admin/users`, `//api//admin`, `..` e `/api/%64ev/admin-token`
    rispondono 400, 403 o 404 e mai un token.
  - Atteso: Java 400 `INVALID_PATH`, Python e AWS 404.
- [ ] **D. Suite esistenti 08 e 12**: ho solo spostato delle keyword in `concurrency_common.resource`
  e `sessions_common.resource`. Devono restare verdi come prima.

---

## 3. Test manuali

- [ ] **1. `knownAccount` rimosso** (react-game)
  - Fatto: il flag non viene più scritto e all'avvio viene cancellato; tolto da tabella cookie e policy EN/IT.
  - Test: su un browser che ha già fatto login Google apri DevTools → Application → Local Storage, ricarica.
  - Atteso: `pathsgames.knownAccount` sparisce; nella finestra cookie e in `cookies.html` non compare più.

- [ ] **2. Scritture AWS: stale invece di 500**
  - Fatto: se la versione cambia tra il claim e la scrittura, la risposta è 409 `STALE_MATCH`, non 500 `WRITE_FAILED`.
  - Test: difficile da provocare a mano (serve un'azione admin nello stesso istante). Gioca una partita lunga
    su AWS test e intanto usa react-admin sulla stessa partita (pausa/ripresa, modifica statistiche).
  - Atteso: in CloudWatch nessun `MATCH_WRITE_FAILED`; nel gioco al massimo la card "Partita in aggiornamento".

- [ ] **3. Esci da tutti i dispositivi** (Java, Python, AWS test)
  - Fatto: un refresh token emesso prima del logout globale è rifiutato anche nei 2 minuti di tolleranza.
  - Test: login Google su due browser A e B; su B ricarica la pagina (il token gira); entro 1 minuto su A
    clicca "Esci da tutti i dispositivi"; su B ricarica subito.
  - Atteso: B torna ospite con "sessione chiusa da un altro dispositivo"; non resta loggato.

- [ ] **4. Sblocco automatico a fine sospensione**
  - Fatto: nuovo endpoint dev `POST /api/dev/users/{uuid}/expire-suspension` (porta admin, solo dev/test).
  - Test: da react-admin sospendi un utente fino a domani; prova il login (rifiutato); poi
    `curl -X POST http://localhost:8044/api/dev/users/<uuid>/expire-suspension`; rifai il login.
  - Atteso: il login riesce; in react-admin l'utente torna attivo (stato 2) e c'è la riga UNBLOCK di SYSTEM.

- [ ] **5. Ban di un utente che sta giocando**
  - Test: utente Google in partita su react-game; da react-admin bannalo; nel gioco fai una mossa e ricarica.
  - Atteso: `ACCOUNT_DISABLED`, avviso in navbar, la partita è `BANNED` dietro il toggle; il refresh non lo riporta dentro.

- [ ] **6. SameSite dei cookie**
  - Test: DevTools → Application → Cookies, dopo un login Google, in locale e su AWS test.
  - Atteso: `pathsgames.refreshToken` HttpOnly, SameSite `Lax` in locale e `None` + Secure su AWS test.
    (Python usa ancora `Path=/`, Java e AWS `/api/auth`: differenza nota, non toccata.)

- [ ] **7. Critical Java: path admin codificato**
  - Fatto: filtro `PathGuardFilter` (400 `INVALID_PATH`), filtri su path decodificato, interceptor ADMIN sui controller admin.
  - Test (Java locale, token di un ospite):
    `curl -i --path-as-is http://localhost:8042/api/%61dmin/users -H "Authorization: Bearer <token ospite>"`
    poi lo stesso con `/api;x/admin/users` e `-X POST http://localhost:8042/api/%64ev/admin-token`.
  - Atteso: 400 `INVALID_PATH`, mai la lista utenti né un token admin.
  - Test di non regressione: in react-admin cerca un utente **per email** e apri il suo dettaglio
    (il path contiene `%40`).
  - Atteso: funziona come prima.

- [ ] **8. Token mock su AWS test** (dopo il passo 4)
  - Test: `curl -i https://<api-test>/api/auth/me -H "Authorization: Bearer MOCK_ACCESS_00000000-0000-0000-0000-000000000001"`
  - Atteso: 401. Login Google e gioco funzionano normalmente.

- [ ] **9. Python: CORS senza credenziali e immagine sicura** (EC2 Python, dopo il passo 6)
  - Test: `curl -i -X OPTIONS http://<ec2>:8042/api/auth/refresh -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST"`
  - Atteso: nessun `access-control-allow-origin: https://evil.example` insieme a `access-control-allow-credentials: true`.
  - Test: dalle origini di `AWS_TEST_APIGW_CORS_ORIGINS` login e refresh funzionano.

- [ ] **10. X-Forwarded-For non falsificabile** (Java o Python locale)
  - Test: `ROBOT_RATE_LIMITS=1 code/scripts/dev/run_robots/run_robot_with_local_java.sh` (limite ospiti 10 per IP).
  - Atteso: suite rate-limit verde. Se lanci a mano 11 `curl -X POST .../api/auth/guest` ognuno con un
    `X-Forwarded-For` diverso, l'11° risponde comunque 429.

- [ ] **11. Banner "Partita in aggiornamento"** (punto 43 della lista Google, ancora aperto)
  - Test: stesso account Google su A e su B (B = Safari/iPhone, oppure qualunque browser con
    `MATCH_REFETCH_BROWSERS=all`). Su B apri la partita **dalla lista in home** e non ricaricare;
    mettila in background; su A fai una mossa; aspetta più di 30 s e torna su B senza cliccare.
  - Atteso: B si aggiorna e in alto compare "Partita in aggiornamento" con il link al log e la ×.
    Controllo inverso: muovi su B, esci più di 30 s, rientra → nessun banner.

- [ ] **12. Cookie iPhone e limite di 7 giorni** (punto 45, alternativa al test reale)
  - Test: Safari su Mac → Sviluppo → Web Inspector → Archiviazione → Cookie.
  - Atteso: `pathsgames.refreshToken` HttpOnly e Secure con scadenza a circa 250 giorni.
    Il rischio vero è un'API su un altro sito (URL execute-api con `SameSite=None`), che Safari blocca come
    terza parte: tenere l'API sullo stesso dominio (`api-*.paths.games`).

- [ ] **13. Permissions boundary IAM della CI** (rollout in 3 fasi; i comandi AWS li lanci tu)
  - Fatto: boundary opzionale su tutti i 15 ruoli Lambda/scheduler; `UpdateAssumeRolePolicy` sempre negato.
  - Passo a: `code/scripts/prod/aws_create_policy_github_actions.sh --dry-run --boundary prepare`
    (controlla), poi senza `--dry-run`. Crea `paths-games-alpha-lambda-boundary` e stampa l'ARN.
  - Passo b: metti l'ARN in `AWS_ALPHA_IAM_PERMISSIONS_BOUNDARY_ARN` (`.env` e GitHub Variable) e fai un deploy alpha (push su `main` o `code/scripts/alpha/deploy_backend.sh`).
  - Passo c: `code/scripts/prod/aws_create_policy_github_actions.sh --boundary enforce`, poi un altro deploy alpha.
  - Atteso: deploy verdi; in console IAM ogni ruolo `pathsgames-alpha-*` mostra la boundary; smoke test alpha OK.
  - Se il passo b fallisce: svuota la variabile e rideploya (torna come prima), poi mandami l'errore.
  - Non fatto: restringere `apigateway:*` alle sole API alpha (va provato con un deploy reale).
