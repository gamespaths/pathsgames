# Node backend — migrazione allo schema documentato `list_*`

> **STATO: COMPLETATA** — 288/288 Robot test passano, `tsc` 0 errori, `jest` 21/21.
> Completata il 12 giugno 2026. Per i dettagli dell'architettura aggiornata vedere
> il README del backend (`code/backend/node/README.md`, sezione "Database").

> Obiettivo originale: allineare lo schema DB del backend Node al modello relazionale
> descritto in `documentation_v0/Step10_CreateDBschema.md` (Step 09/10), già usato
> da Java, Python e PHP. Sostituisce l'attuale schema Prisma a PK `cuid`.

## Stato di partenza
- Lo schema attuale (`prisma/schema.prisma`) usa PK `cuid` stringa e ~24 modelli semplificati.
- I robot test passano 288/288 sul **contratto API** (non sullo schema DB).
- La migrazione **romperà temporaneamente** build e test finché non è completata.
- Sorgente di verità per le colonne esatte: le DDL Java
  `code/backend/java/adapter-postgres/src/main/resources/db/migration/v0/V0.10.*.sql`
  (+ `v0_19/V0.19.5/6/7` per i campi stat aggiunti) e
  `adapter-sqlite/.../dev/R__insert_story_seed_data.sql` per i valori seed.

## Modello target (tabelle `list_*`)

PK: `list_stories` → `id BIGSERIAL` singolo; **tutte le altre** `list_*` → PK composita
`(id, id_story)` (per `list_character_templates` la PK è `(id_tipo, id_story)`).
Timestamp: `ts_insert` / `ts_update` (VARCHAR). I riferimenti `id_text_*` puntano a
`list_texts(id_story, id_text, lang)` e si risolvono a runtime (non FK formali).

Tabelle dominio storia (27):
`list_stories, list_stories_difficulty, list_keys, list_classes, list_classes_bonus,
list_traits, list_character_templates, list_locations, list_locations_neighbors,
list_items, list_items_effects, list_weather_rules, list_events, list_events_effects,
list_choices, list_choices_conditions, list_choices_effects, list_global_random_events,
list_missions, list_missions_steps, list_creator, list_cards, list_texts`.
Auth: `list_users` / guests + token (mantenere quelle attuali se il contratto auth non cambia).
Gaming: tabelle match/state usate dalle API match (Step 19/20/21/23).

### Modellazione in Prisma (punti critici)
1. **PK composite**: usare `@@id([id, idStory])` con `id Int` e `idStory Int`.
   Niente `@default(autoincrement())` su `id` (le PK composite non lo permettono in
   Postgres via Prisma): gli `id` arrivano dall'import o vengono assegnati dall'app
   con una sequenza "max+1 per storia". Solo `list_stories.id` resta autoincrement.
2. **uuid**: ogni tabella ha `uuid String @unique @default(uuid())` (lookup secondario).
3. **Naming**: i modelli Prisma in camelCase con `@map("snake_case")` sulle colonne e
   `@@map("list_xxx")` sulle tabelle, così il DB resta `list_*` come da documentazione.
4. **Relazioni composite**: FK `(id_class, id_story) → list_classes(id, id_story)` si
   modellano con `@relation(fields:[idClass, idStory], references:[id, idStory])`.
5. **Timestamp**: `tsInsert String @map("ts_insert")` ecc. (oppure DateTime se si
   preferisce; la documentazione usa VARCHAR — mantenere VARCHAR per fedeltà).

## Strategia per non rompere il contratto API
Le risposte REST (validate dai 288 robot) devono restare IDENTICHE. Quindi:
- I servizi continuano a esporre gli stessi campi JSON di oggi.
- Dove oggi si espone `uuid` di una sotto-entità, si continua a esporlo (la colonna
  `uuid` esiste in ogni `list_*`).
- Dove i test si aspettano `id` intero (es. admin GET story `id`, template `idCard`,
  trait `idClassPermitted` interi) il nuovo modello li espone nativamente.
- L'import assegna `id` interi scoped per storia e rileva i duplicati come oggi.

## Fasi (eseguire in quest'ordine, su branch/worktree dedicato)
1. **schema.prisma** → tutte le `list_*` (story + auth + gaming) con PK/maps corrette.
   `npx prisma generate` deve passare.
2. **Repository** Prisma: story, difficulty, match, guest, token → query sulle nuove tabelle.
3. **StoryImportService**: persistere su `list_*` con id interi scoped + risoluzione
   `id_text` per i titoli; mantenere wipe-on-reimport (stesso uuid) e 400 duplicati.
4. **StoryQueryService + ContentQueryService**: ricostruire le risposte detail/summary,
   risolvendo `id_text_*` → `list_texts` per lang; card via `id_card`.
5. **StoryCrudService**: CRUD admin generico mappato sulle `list_*` (tutti i 23 tipi).
6. **Match services + seed.js**: match/gaming + seed che inserisce le `list_*`
   (valori da `R__insert_story_seed_data.sql`).
7. **Verifica**: `npx tsc`, `npx jest`, e robot 288/288 via
   `code/scripts/dev/run_robots/run_robot_with_local_node.sh` (volume Docker pulito).

## Rischi
- PK composite + sequenze "max+1 per storia" sotto concorrenza: per l'import va bene
  (single-writer); per il gaming valutare lock/transazioni.
- Le 8 tabelle oggi assenti in Node (neighbors, items_effects, weather_rules,
  events_effects, choices_conditions/effects, global_random_events, missions_steps)
  vanno aggiunte: l'API admin CRUD le elencherà (oggi ritornano `[]` di default).
- Tabelle gaming/log/snapshot (25) non toccate dal contratto API: includere solo
  quelle effettivamente usate dalle API match.

## Esito
Tutte le 7 fasi completate; lo schema vivo è `prisma/schema.prisma` (32 modelli
`list_*`/`users`/`gaming_*`). I file di bozza (`schema.target.prisma`) e backup
(`schema.cuid-backup.prisma`) sono stati rimossi a migrazione conclusa.
