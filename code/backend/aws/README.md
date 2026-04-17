# Paths Games - AWS Serverless Backend

Welcome to the **Serverless** version of the Paths Games backend! This project offers a high-performance, scalable, and extremely cost-effective alternative to traditional backends (Java/Python/PHP) based on relational databases.

## 🚀 Architecture

The infrastructure is built entirely on managed AWS services:

- **AWS API Gateway (HTTP API v2)**: Lightweight gateway with CORS configured for localhost and credentials enabled.
- **AWS Lambda (Python 3.13)**: FaaS functions with explicit names (`pathsgames-<env>-<Function>`).
- **AWS DynamoDB**: NoSQL Database using Single Table Design with Global Secondary Indexes (GSI).
- **AWS CloudWatch Logs**: Log Groups managed by the template, automatically deleted with the stack (retention: 14 days).
- **AWS SAM + CloudFormation**: Infrastructure-as-Code with multi-environment deployment.

### Created Resources

| Resource | Name | Type |
| :--- | :--- | :--- |
| DynamoDB Table | `PathsGamesBackend-<env>` | `AWS::DynamoDB::Table` |
| HTTP API | — | `AWS::Serverless::HttpApi` |
| Lambda Echo | `pathsgames-<env>-EchoFunction` | Health check (`GET /api/echo/status`) |
| Lambda Auth | `pathsgames-<env>-AuthFunction` | Guest + admin authentication (11 routes) |
| Lambda Story | `pathsgames-<env>-StoryFunction` | Story catalog + admin + content (9 routes) |
| Lambda Seed | `pathsgames-<env>-SeedFunction` | Dev-only: inserts test data |
| Log Groups ×4 | `/aws/lambda/pathsgames-<env>-*` | Deleted with the stack |

### Tagging

All resources are tagged with:
- `project` = `PathsGames`
- `env` = `dev` | `prod`

### Complete Cleanup

When the stack is deleted (`sam delete`), **all** objects are removed:
- Lambda Functions, API Gateway, DynamoDB Table
- **CloudWatch Log Groups** (explicitly managed in the template with `DeletionPolicy: Delete`)

No orphaned objects remain in the AWS account.

## 🔐 Authentication

The Lambdas support two authentication modes:

1. **Real JWTs (HS256)**: Tokens issued by the Java backend, verified with the same secret key. Claims: `sub` (UUID), `username`, `role`, `type`, `exp`.
2. **Mock tokens**: `MOCK_ACCESS_{uuid}` tokens for local development and testing with users created via seed.

Verification is centralized in `lambda/common/jwt_utils.py` (pure Python stdlib, no external dependencies).

## 🗂️ Project Structure

```text
code/backend/aws/
├── template.yaml         # Unified AWS SAM template
├── samconfig.toml        # Environment configurations (dev, prod)
├── lambda/               # Function source code
│   ├── common/           # Shared code (db_utils, jwt_utils)
│   ├── auth/             # Guest login, sessions, admin guests (11 routes)
│   ├── story/            # Catalog, categories, groups, enriched detail, import (9 routes)
│   ├── seed/             # Dev seed: inserts test users and stories
│   └── echo/             # Health check and diagnostics
└── README.md             # This file
```

## 🛠️ Data Mapping (PK/SK Example)

All entities coexist in the same table using a prefix for differentiation:

| Entity | Partition Key (PK) | Sort Key (SK) | GSI1_PK (Example) |
| :--- | :--- | :--- | :--- |
| **User** | `USER#<uuid>` | `METADATA` | `USER_LIST` |
| **Story** | `STORY#<uuid>` | `METADATA` | `STORY_LIST` |
| **Match** | `MATCH#<uuid>` | `METADATA` | `USER#<uuid>` |

## 🚀 Deployment with AWS SAM

The project uses **AWS SAM** to handle packaging and deployment across different environments.

### Prerequisites
- Install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
- Configure AWS credentials (`aws configure`).
- Create an S3 bucket for CloudFormation templates (e.g., `pathsgames-cloudformation-dev`).

### Main Commands

| Operation | Command |
| :--- | :--- |
| **Validate** | `sam validate --lint` |
| **Build** | `sam build` |
| **Deploy (Dev)** | `sam deploy --config-env dev` |
| **Deploy (Prod)** | `sam deploy --config-env prod` |
| **Real-time Logs** | `sam logs -f --stack-name pathsgames-dev` |
| **Delete stack** | `sam delete --config-env dev` |
| **Read API url** | `API_URL=$(aws cloudformation describe-stacks --stack-name pathsgames-dev --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)` |
| **Seed test users** | `curl -X POST "$API_URL/api/dev/seed" -H "Content-Type: application/json" -d '{}'` |

### Environment Configuration (`samconfig.toml`)

| Parameter | Dev | Prod |
| :--- | :--- | :--- |
| Stack name | `pathsgames-dev` | `pathsgames-prod` |
| S3 bucket | `pathsgames-cloudformation` | `pathsgames-cloudformation` |
| Region | `us-east-2` | — |

The `deploy` command output will provide the **API Endpoint URL** to be configured in the frontend.

---

## 🧐 Why one table? (Single Table Design)

In DynamoDB, the modern best practice is to use **a single table** instead of one table per entity. Here's why we chose this path for Paths Games:

### 1. Minimal Costs 📉
DynamoDB bills based on read/write capacity units (RCU/WCU) or per request. With a single table, we centralize capacity and optimize spending.

### 2. High Performance & Pre-calculated Joins ⚡
We model data so that related entities share the same **Partition Key (PK)** but have different **Sort Keys (SK)**. Thus, with a single query, we can download everything needed for an operation, achieving sub-10ms latencies.

### 3. Unlimited Horizontal Scalability 🌐
AWS manages the scaling of a single table transparently.

### 4. Operational Simplicity 🛠️
One set of IAM Roles, one backup plan, and one point of monitoring on CloudWatch. Fewer moving parts mean less chance of error.

# < Paths Games />

All source code and information in this repository are the result of careful and patient development work by the developer team, who have made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit the [Paths.Games](https://paths.games/) website.

## License

Made with ❤️ by the <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>

Public projects:
<a href="https://www.gnu.org/licenses/gpl-3.0" valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*

The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.

Narrative Content & Assets: The story, dialogues, characters, sounds, music, art, and world-building (located in the `/data` folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).

(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.
