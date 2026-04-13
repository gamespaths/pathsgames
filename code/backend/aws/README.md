# Paths Games - AWS Serverless Backend

Benvenuto nella versione **Serverless** del backend di Paths Games! Questo progetto offre un'alternativa ad alte prestazioni, scalabile ed estremamente economica rispetto ai backend tradizionali (Java/Python/PHP) basati su database relazionali.

## 🚀 Architettura

L'infrastruttura è costruita interamente su servizi gestiti di AWS:

- **AWS API Gateway (HTTP API v2)**: Gateway leggero con CORS configurato per localhost e credenziali abilitate.
- **AWS Lambda (Python 3.13)**: Funzioni FaaS con nomi espliciti (`pathsgames-<env>-<Function>`).
- **AWS DynamoDB**: Database NoSQL Single Table Design con GSI.
- **AWS CloudWatch Logs**: Log Groups gestiti dal template, eliminati automaticamente con lo stack (retention: 14 giorni).
- **AWS SAM + CloudFormation**: Infrastructure-as-Code con deploy multi-ambiente.

### Risorse create

| Risorsa | Nome | Tipo |
| :--- | :--- | :--- |
| DynamoDB Table | `PathsGamesBackend-<env>` | `AWS::DynamoDB::Table` |
| HTTP API | — | `AWS::Serverless::HttpApi` |
| Lambda Echo | `pathsgames-<env>-EchoFunction` | Health check (`GET /api/echo/status`) |
| Lambda Auth | `pathsgames-<env>-AuthFunction` | Autenticazione guest + admin (11 route) |
| Lambda Story | `pathsgames-<env>-StoryFunction` | Catalogo storie + admin (5 route) |
| Lambda Seed | `pathsgames-<env>-SeedFunction` | Dev-only: inserisce utenti di test |
| Log Groups ×4 | `/aws/lambda/pathsgames-<env>-*` | Eliminati con lo stack |

### Tagging

Tutte le risorse sono taggate con:
- `project` = `PathsGames`
- `env` = `dev` | `prod`

### Cleanup completo

Quando si elimina lo stack (`sam delete`), vengono rimossi **tutti** gli oggetti:
- Lambda Functions, API Gateway, DynamoDB Table
- **CloudWatch Log Groups** (gestiti esplicitamente nel template con `DeletionPolicy: Delete`)

Nessun oggetto orfano rimane nell'account AWS.


## 🔐 Autenticazione

Le Lambda supportano due modalità di autenticazione:

1. **JWT reali (HS256)**: Token emessi dal backend Java, verificati con la stessa chiave segreta. Claims: `sub` (UUID), `username`, `role`, `type`, `exp`.
2. **Mock tokens**: Token `MOCK_ACCESS_{uuid}` per sviluppo locale e test con utenti creati tramite seed.

La verifica è centralizzata in `lambda/common/jwt_utils.py` (puro stdlib Python, nessuna dipendenza esterna).



## 🗂️ Struttura del progetto

```text
code/backend/aws/
├── template.yaml         # Template unificato AWS SAM
├── samconfig.toml        # Configurazioni per ambienti (dev, prod)
├── lambda/               # Codice sorgente delle funzioni
│   ├── common/           # Codice condiviso (db_utils, jwt_utils)
│   ├── auth/             # Login Guest, sessioni, admin guests (11 route)
│   ├── story/            # Catalogo storie, import, admin (5 route)
│   ├── seed/             # Dev seed: inserisce utenti di test
│   └── echo/             # Health check e diagnostica
└── README.md             # Questo file
```

## 🛠️ Come mappare i dati (Esempio PK/SK)

Tutte le entità convivono nella tabella usando un prefisso per differenziarsi:

| Entità | Partition Key (PK) | Sort Key (SK) | GSI1_PK (Esempio) |
| :--- | :--- | :--- | :--- |
| **User** | `USER#<uuid>` | `METADATA` | `AUTH#USER` (per login) |
| **Story** | `STORY#<uuid>` | `METADATA` | `STORY_LIST` (per catalogo) |
| **Match** | `MATCH#<uuid>` | `METADATA` | `USER#<uuid>` (match history) |



## 🚀 Deploy con AWS SAM

Il progetto utilizza **AWS SAM** per gestire il packaging e il deploy in diversi ambienti.

**Prerequisiti**
- Installare [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
- Configurare le credenziali AWS (`aws configure`).
- Creare il bucket S3 per i template CloudFormation `pathsgames-cloudformation-dev`:

### Comandi principali

| Operazione | Comando |
| :--- | :--- |
| **Validate** | `sam validate --lint` |
| **Build** | `sam build` |
| **Deploy (Dev)** | `sam deploy --config-env dev` |
| **Deploy (Prod)** | `sam deploy --config-env prod` |
| **Real-time Logs** | `sam logs -f --stack-name pathsgames-dev` |
| **Delete stack** | `sam delete --config-env dev` |
| **Read API url** | `API_URL=$(aws cloudformation describe-stacks --stack-name pathsgames-dev --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)` |
| **Seed test users** | `curl -X POST "$API_URL/api/dev/seed" -H "Content-Type: application/json" -d '{}'` |

### Configurazione ambienti (`samconfig.toml`)

| Parametro | Dev | Prod |
| :--- | :--- | :--- |
| Stack name | `pathsgames-dev` | `pathsgames-prod` |
| S3 bucket | `pathsgames-cloudformation` | `pathsgames-cloudformation` |
| Region | `us-east-2` | — |

L'output del comando `deploy` fornirà l'**API Endpoint URL** da configurare nel frontend.


---

## 🧐 Perché una sola tabella? (Single Table Design)

In DynamoDB, la best practice moderna è quella di utilizzare **una sola tabella** invece di una tabella per ogni entità (come faresti in un DB relazionale). Ecco perché abbiamo scelto questa strada per Paths Games:

### 1. Costi ridotti al minimo 📉
DynamoDB fattura in base alle unità di lettura/scrittura (RCU/WCU) o per singola richiesta. Con una sola tabella, centralizziamo la capacità e ottimizziamo la spesa.

### 2. Performance e Join pre-calcolate ⚡
Modelliamo i dati in modo che entità correlate abbiano la stessa **Partition Key (PK)** ma diverse **Sort Keys (SK)**. Così, con una singola query, scarichiamo tutto ciò che serve per un'operazione, ottenendo latenze sotto i 10ms.

### 3. Scalabilità orizzontale illimitata 🌐
AWS gestisce lo scaling di una singola tabella in modo trasparente.

### 4. Semplicità operativa 🛠️
Un solo set di IAM Roles, un solo piano di backup, un solo punto di monitoraggio su CloudWatch. Meno pezzi mobili significano meno possibilità di errore.


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
