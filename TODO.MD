# TODO — Portare gli stessi fix su Python / PHP / AWS Lambda

Obiettivo: replicare i fix già stabilizzati nel backend Java (SQLite CRUD create, compatibilità PostgreSQL/Flyway, mapping/coerenza `id_story`, aggiornamento documentazione e validazione test) anche sugli altri backend.

## 1) Python backend (`code/backend/python`)

### 1.1 Analisi gap
- Mappare endpoint equivalenti a Step 17 (create/update sub-entity story).
- Verificare se esiste pattern di ID scoped (`id` + `id_story`) e dove viene assegnato.
- Cercare errori tipo:
  - SQLite `NOT NULL` su `id` in create.
  - PostgreSQL bind/mapping incoerenti su `id_story`.

### 1.2 Implementazione
- In create, se `id` manca/null, assegnare `next scoped id` per `id_story`.
- Uniformare persistenza per evitare doppia scrittura di `id_story` (campo base + campo locale).
- Se presenti migration SQL/Flyway/Alembic:
  - rimuovere/aggiustare FK che assumono `id` globale quando ora è scoped.

### 1.3 Verifica
- Eseguire test unit backend Python.
- Eseguire test E2E/Robot contro backend Python (se disponibili).
- Verificare CRUD admin su almeno: locations, keys, choices, missions, creators.

### 1.4 Documentazione
- Aggiornare `code/backend/python/README.md` con:
  - fix applicati,
  - comandi di verifica,
  - stato pass/fail finale.

---

## 2) PHP backend (`code/backend/php`)

### 2.1 Analisi gap
- Identificare endpoint/admin controller CRUD equivalenti.
- Verificare gestione ID numerici su create (`id`, `id_story`).
- Verificare SQL insert e binding parametri su PostgreSQL/SQLite.

### 2.2 Implementazione
- Aggiungere assegnazione automatica `id` scoped quando assente.
- Correggere layer ORM/query builder per evitare colonne duplicate in INSERT.
- Allineare migration/schema FK a chiavi scoped per story.

### 2.3 Verifica
- Eseguire `phpunit` e test integrazione disponibili.
- Eseguire scenario CRUD admin completo su SQLite e PostgreSQL.
- Confermare assenza di errori 500 e vincoli `NOT NULL`/bind.

### 2.4 Documentazione
- Aggiornare `code/backend/php/README.md` con fix, comandi, risultati.

---

## 3) AWS Lambda backend (`code/backend/aws`)

### 3.1 Analisi gap
- Individuare Lambda/API Gateway che gestiscono CRUD story.
- Verificare path di persistenza (SQL diretto, ORM, repository custom).
- Verificare modello dati per scoped keys e mapping `id_story`.

### 3.2 Implementazione
- Introdurre logica di assegnazione `next scoped id` lato handler/service quando `id` manca.
- Correggere payload-to-DB mapping per evitare duplicazioni campo `id_story`.
- Aggiornare template/migration/script DB se FK non compatibili con scoped IDs.

### 3.3 Verifica
- Eseguire test locali Lambda (unit + integration).
- Eseguire test end-to-end via API locali (SAM/localstack se usati).
- Testare CRUD admin su subset critico: choices, missions, keys, locations, creators.

### 3.4 Documentazione
- Aggiornare `code/backend/aws/README.md` con:
  - prerequisiti,
  - comandi di run/test,
  - stato validazione SQLite/PostgreSQL (o database equivalente).

---

## 4) Checklist comune di accettazione (Python/PHP/AWS)

- [ ] Create CRUD non fallisce più con `NOT NULL` su `id` quando payload non lo include.
- [ ] Nessun insert con colonne duplicate (`id_story` ripetuto).
- [ ] Migrations/FK compatibili con modello scoped (`id`, `id_story`).
- [ ] Test unit verdi.
- [ ] Test integrazione/E2E verdi.
- [ ] README backend aggiornato con fix + comandi + risultati.

## 5) Sequenza consigliata di lavoro

1. Python (più veloce da iterare).
2. PHP (allineamento ORM/query + test).
3. AWS Lambda (adattamento handler + validazione ambiente).
4. Consolidamento documentazione cross-backend.

## 6) Deliverable finali

- Patch codice per ogni backend.
- Output test (unit + integrazione/E2E) per ogni backend.
- Aggiornamento README di ogni backend.
- Nota di rilascio unica con tabella stato finale (Java/Python/PHP/AWS).
