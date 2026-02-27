# Paths Games - WebSite - AWS Infrastructure (Terraform)

This Terraform project provisions the complete AWS infrastructure to host the **Paths Games** static website on the `paths.games` and `pathsgames.com` domain.

## Architecture Overview

```
User → Route 53 (paths.games) → CloudFront (CDN) → S3 Bucket (pathsgames-com)
                                      ↑
                              WAF v2 (Firewall)
                              ACM (SSL/TLS)
                              Security Headers
```

## Resources Created

### S3 Bucket (`s3.tf`)
- **Bucket name:** `pathsgames-com`
- **Public access:** Fully blocked — content is served exclusively through CloudFront
- **Encryption:** AES-256 server-side encryption at rest
- **Versioning:** Enabled for rollback safety
- **Bucket policy:** Allows access only from the CloudFront distribution via Origin Access Control (OAC)

### CloudFront Distribution (`cloudfront.tf`)
- **Origin Access Control (OAC):** Secure connection between CloudFront and S3 (replaces the legacy OAI method)
- **HTTPS only:** HTTP requests are automatically redirected to HTTPS
- **TLS version:** Minimum TLS 1.2 (2021 policy)
- **HTTP/2 + HTTP/3:** Enabled for maximum performance
- **Price class:** `PriceClass_100` — edge locations in US and Europe
- **SPA support:** Custom error responses for 403/404 redirect to `index.html`
- **Compression:** Enabled (gzip/brotli)
- **Aliases:** `paths.games` and `www.paths.games`

### ACM Certificate (`cloudfront.tf`)
- **Domain:** `paths.games` with wildcard `*.paths.games`
- **Validation:** DNS validation — you must add the CNAME records provided by ACM to your domain's DNS
- **Region:** `us-east-1` (required for CloudFront certificates)

### Security Headers (`cloudfront.tf`)
CloudFront injects the following security headers on every response:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Content-Security-Policy` | `default-src 'self'; ...` | Restrict resource loading |

### WAF v2 – Web Application Firewall (`waf.tf`)
- **Rate limiting:** Blocks IPs sending more than 1,000 requests in 5 minutes
- **AWS Managed Rules – Common Rule Set:** Protects against OWASP Top 10 threats (SQL injection, XSS, etc.)
- **AWS Managed Rules – Known Bad Inputs:** Blocks requests with known malicious patterns
- **Bot Control:** Available but commented out (has additional AWS cost)
- **CloudWatch metrics:** Enabled for all rules
- **Disabled by default:** WAF is controlled by the `enable_waf` variable (default: `false`) to avoid costs during development

## Terraform State

The state file is stored remotely in S3, configured via `backend.hcl`:
- **Bucket:** `terraform-aws` (configurable)
- **Key:** `PathsGameWebsite/terraform.tfstate`
- **Region:** `eu-central-1` (independent from the resources region)

The backend configuration is **parametric** — edit `backend.hcl` to change the bucket name, key, or region:

```hcl
# backend.hcl
bucket = "terraform-aws"
key    = "PathsGameWebsite/terraform.tfstate"
region = "eu-central-1"
```

> **Note:** The backend bucket must already exist before running `terraform init`. The backend region can differ from the resources region (`us-east-1`).

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.5 installed
3. **S3 bucket** `terraform-aws` already created for remote state
4. **Domain** `paths.games` registered and accessible via Route 53 or external DNS

## Deployment

```bash
# Initialize Terraform (downloads providers, configures backend)
cd code/website/terraform-aws
terraform init -backend-config=backend.hcl

# Preview the changes
terraform plan

# Apply the infrastructure
terraform apply
```

### Enable WAF

WAF is **disabled by default** to save costs during development. To enable it:

```bash
# Option 1: pass the variable on the command line
terraform apply -var="enable_waf=true"

# Option 2: create a terraform.tfvars file
echo 'enable_waf = true' >> terraform.tfvars
terraform apply
```

When enabled, WAF adds ~$6/month base cost plus $1 per million requests.

### After `terraform apply`:

1. **Validate the ACM certificate:** Terraform will output the DNS CNAME records needed for certificate validation. Add them to your domain's DNS (Route 53 or your registrar's DNS panel).

2. **Configure DNS:** Point `paths.games` and `www.paths.games` to the CloudFront distribution domain name (shown in the outputs).

3. **Deploy website files:** Sync your static files to the S3 bucket:
   ```bash
   aws s3 sync ../html/ s3://pathsgames-com --delete
   ```

4. **Invalidate CloudFront cache** (after updating content):
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id <DISTRIBUTION_ID> \
     --paths "/*"
   ```

## Outputs

| Output | Description |
|--------|-------------|
| `s3_bucket_name` | Name of the S3 bucket |
| `s3_bucket_arn` | ARN of the S3 bucket |
| `cloudfront_distribution_id` | CloudFront distribution ID (needed for cache invalidation) |
| `cloudfront_domain_name` | CloudFront domain name (e.g., `d1234abcdef.cloudfront.net`) |
| `acm_certificate_arn` | ARN of the SSL/TLS certificate |
| `waf_web_acl_arn` | ARN of the WAF Web ACL |
| `website_url` | Full website URL (`https://paths.games`) |

## File Structure

```
terraform-aws/
├── main.tf          # Provider config, backend (partial), required versions
├── backend.hcl      # Backend S3 configuration (bucket, key, region)
├── variables.tf     # Input variables (region, domain, bucket name, tags)
├── s3.tf            # S3 bucket with security settings
├── cloudfront.tf    # CloudFront distribution, ACM certificate, security headers
├── waf.tf           # WAF v2 rules (rate limit, OWASP, bad inputs)
├── outputs.tf       # Terraform outputs
└── README.md        # This file
```

## Cost Estimate

| Service | Estimated Monthly Cost |
|---------|----------------------|
| S3 | ~$0.03 (minimal storage) |
| CloudFront | ~$1–5 (depends on traffic) |
| ACM | Free |
| WAF v2 | ~$6 (base) + $1 per million requests (disabled by default) |
| Route 53 | ~$0.50 per hosted zone |
| **Total (without WAF)** | **~$2–6/month** for a low-traffic site |
| **Total (with WAF)** | **~$8–12/month** for a low-traffic site |

> Enabling Bot Control adds ~$10/month.




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




