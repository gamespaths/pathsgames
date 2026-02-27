# Paths Games V1 - Step 07: Configure the Website

This document describes the **website and infrastructure setup** for **Paths Games**, covering the static site architecture, AWS infrastructure (Terraform), visual design, and responsive behavior.

  - ✅ Define and buy domains

  - ✅ Create Terraform template

  - ✅ Deploy Terraform template into AWS

  - ✅ Create first version of website

  - ✅ Deploy first version of website

## 1. Domains

Two domains have been registered for the project:

| Domain | Purpose |
|--------|---------|
| `paths.games` | Primary domain |
| `pathsgames.com` | Secondary / alias domain |

Both domains (plus `www.*` variants) point to the same CloudFront distribution, giving four total aliases: `paths.games`, `www.paths.games`, `pathsgames.com`, `www.pathsgames.com`.



## 2. AWS Infrastructure (Terraform)

The entire hosting infrastructure is defined as **Infrastructure as Code** using Terraform (>= 1.5) with the AWS provider (~> 5.0). State is stored remotely in an S3 backend.

### 2.1 Architecture

```
Route 53 (DNS)  ──►  CloudFront (CDN + HTTPS)  ──►  S3 (Static Files)
                          │
                          ├── ACM Certificate (TLS)
                          ├── Security Headers Policy
                          ├── WAF (optional)
                          └── Geo-Restriction (RU, BY, CN blocked)
```

### 2.2 Terraform Files

| File | Purpose |
|------|---------|
| `main.tf` | Provider config, backend reference, default tags |
| `variables.tf` | Input variables (7 total) |
| `s3.tf` | S3 bucket, access block, encryption, versioning, bucket policy |
| `cloudfront.tf` | ACM certificate, OAC, distribution, security headers policy |
| `waf.tf` | AWS WAF v2 (conditional, disabled by default) |
| `outputs.tf` | 8 output values for reference |
| `backend.hcl` | Partial S3 backend config |

### 2.3 Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `aws_region` | `string` | `us-east-1` | AWS region (CloudFront + ACM require us-east-1) |
| `domain_name` | `string` | `paths.games` | Primary domain |
| `second_domain_name` | `string` | `pathsgames.com` | Secondary domain alias |
| `bucket_name` | `string` | `pathsgames-com` | S3 bucket name |
| `environment` | `string` | `production` | Environment tag |
| `enable_waf` | `bool` | `false` | Toggle WAF (adds extra cost) |
| `tags` | `map(string)` | `{Project="PathsGames", ManagedBy="Terraform"}` | Common tags |

### 2.4 S3 Bucket

The website is hosted in a private S3 bucket with:

- **Public access fully blocked** — all four public access block settings set to `true`
- **Server-side encryption** — AES-256 at rest
- **Versioning enabled** — for rollback safety
- **Bucket policy** — allows only CloudFront OAC to call `s3:GetObject`, conditioned on the distribution ARN

Content is never publicly accessible directly; all access goes through CloudFront.

### 2.5 CloudFront Distribution

| Setting | Value |
|---------|-------|
| HTTP version | HTTP/2 + HTTP/3 |
| Price class | `PriceClass_100` (US + Europe) |
| Protocol | Redirect HTTP → HTTPS |
| TLS version | TLSv1.2_2021 minimum |
| Compression | Enabled |
| Cache policy | AWS Managed `CachingOptimized` |
| Default root object | `index.html` |
| SPA fallback | 403 and 404 → `/index.html` (response code 200) |
| Geo-restriction | Blacklist: **RU** (Russia), **BY** (Belarus), **CN** (China) |

**ACM Certificate** — covers `paths.games` plus SANs: `*.paths.games`, `pathsgames.com`, `*.pathsgames.com`. DNS validation with `create_before_destroy` lifecycle.

**Origin Access Control (OAC)** — S3 origin type, SigV4 signing, always sign requests.

### 2.6 Security Headers

CloudFront attaches a custom response headers policy with:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | See below |

**CSP directive:**
```
default-src 'self';
script-src  'self' https://cdn.jsdelivr.net;
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;
font-src    'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
img-src     'self' data:;
connect-src 'self'
```

The CSP explicitly whitelists the CDN domains used by Bootstrap, Font Awesome, and Google Fonts.

### 2.7 WAF (Optional)

Disabled by default (`enable_waf = false`) to save costs. When enabled, provides:

| Rule | Priority | Type | Detail |
|------|----------|------|--------|
| `RateLimitRule` | 1 | Rate-based | Block after 1000 requests per 5 minutes per IP |
| `AWSManagedRulesCommonRuleSet` | 2 | AWS managed | OWASP Top 10 protection |
| `AWSManagedRulesKnownBadInputsRuleSet` | 3 | AWS managed | Known bad input patterns |

Bot control rule set is available but commented out due to extra cost.

### 2.8 Outputs

| Output | Value |
|--------|-------|
| `s3_bucket_name` | Bucket ID |
| `s3_bucket_arn` | Bucket ARN |
| `cloudfront_distribution_id` | Distribution ID |
| `cloudfront_domain_name` | CloudFront domain |
| `cloudfront_distribution_arn` | Distribution ARN |
| `acm_certificate_arn` | Certificate ARN |
| `waf_web_acl_arn` | WAF ACL ARN (null if disabled) |
| `website_url` | `https://paths.games` |

### 2.9 Deployment Commands

```bash
# Initialize Terraform with remote backend
terraform init -backend-config=backend.hcl

# Review planned changes
terraform plan

# Apply infrastructure changes
terraform apply

# Sync website files to S3
aws s3 sync ../html/ s3://pathsgames-com --delete

# Invalidate CloudFront cache (after deploy)
aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

### 2.10 Cost Estimate

| Scenario | Estimated monthly cost |
|----------|----------------------|
| Without WAF | ~$2–6/mo |
| With WAF enabled | ~$8–12/mo |



## 3. Website Structure

The website is a **single-page static site** served from the `html/` directory. All visual content is rendered client-side using vanilla JavaScript — no build tools, no framework.

### 3.1 File Structure

```
html/
├── assets/
│   └── background.jpg        ← full-page background image
├── index.html                 ← main HTML page (125 lines)
├── variables.css              ← CSS custom properties / design tokens (64 lines)
├── style.css                  ← all visual styles (738 lines)
└── main.js                    ← data-driven card rendering, interactions (248 lines)
```

### 3.2 External Dependencies (CDN)

| Library | Version | CDN | Purpose |
|---------|---------|-----|---------|
| Bootstrap | 5.3.3 | jsdelivr.net | CSS utilities, grid, spacing |
| Font Awesome | 5.15.4 | cdnjs.cloudflare.com | Icon library |
| Google Fonts | — | fonts.googleapis.com | Cinzel, Cinzel Decorative, Crimson Text |




# Version Control
- First version created with AI prompt:
    - i wanna create a website for my crowdfounding, i'm creating a multiplayer video game with game book mecanics, i wanna build the website with bootstrap5 and fontawesome5 and css3 on dedicated files with variables for all color and configurations, i wanna all elements in the web pages is "cards" like cards-game like "magic" and "pokemon card game". esist only two type of card : little and big, little is double of big, could be vertical or horizontal, every card on top has a title, an icon, an image and a description like magic cards, all cars must be overexposed with middle cars on top. In page on top-center an horizontal big-card in horizontal with title "paths games" and big-card in horizontal with "free to play" card, on left "crowdfounding coming soon" big-card in horizontal. On left a big big-vertical-card of location "castle" with two little vertical card on bottom with "enter into castle" and "go to mountains" side by side with little oblique. on center a big-vertical-card location "mountains" with two little-vertical-card "back to castle" and "enter the cave", on right a big-vertical-card location "dragon cave" with choose "talk with dragon" and "attack the dragon", i wanna a medieval style, with dark theme option, i wanna card "paths games" in gold style. add a footer with copyright, main and repository information. every card have a mediaval-brownish styles
    - bigger title on desktop and centered for mobile, remove background images and create a card style like medieval-brownly style. change "The World of Aethermoor" with "choose your destiny" , on location cards remove background images, create border and style like medieval-brownly with title, image/emote, description. The chooser card must be above location card with slightly inclined. Create a section "Crowdfunding coming soon" with page where descript the Crowdfunding is coming soon with a new free to play game ispired to a classic game-books but with modern mecanics. will be free to play with new fantastic and modern stories! Change the footer to be little and with only logos without "back the quest"
    - on navbar remove "world" and "aboud" section, leave only "Crowdfunding" section, show dark style button only in desktop , move Crowdfunding after world section and use more lightly text color. in world section move "card-choice" cards below the location card, bigger location card and choise card slightly inclined. on footer, icons and description on new line, add github icon and Roadmap and Crowdfunding and Devlog, for every icon add title, add a new line with "© 2025 Paths Games · All rights reserved · Crafted with  by the Paths Games Dev Team · Privacy Policy · Terms of Service - cookies policy"
    - use "background.jpg" like background on dekstop, create mobile version using same background on vertical , remove "Toggle theme", 
    - i wanna world-row and crowdfund-section bigger full page, increase all font size everywhere and linear-gradient on footer more hight rispect the footer contents
    - on mobile repeat the background images, the locations and choise must be on javascript array and loaded, create a location-card and choise-card, every card must be golden-bronze simple-decorative border with plate for title, emote on top right, 2/3 body of image and 1/3 for shot description
    - add icons with "code-fork", "code marge" and "code-pull" and other choise style icons in page
    - edit card css: all cards type must be have same dimensions (locations and coises , location big, coises little), card-title-plate on right and remove card-emote-badge! in all cards font bigger.
    - card-title-plate on top with horizontal text, for every card add a little footer with random code (like magic style)
    - i wanna carosel on element "navbar-badges-to-rotate" i just added into navbar and change buttons styles, add crowdfuning element and "open source code" element
    - crowdfund-badges bigger, double dimensions
    - on "choice-card" and "location-card" on header put icon on right
    - on "choice-card" and "location-card" use background2.png like background image on "card-body-left" and change text color in dark gold
    - remove background2 image and use "background: linear-gradient(135deg, #1e0f04 0%, #5c3317 40%, #2e1508 100%);"
    - i wanna make responsive page, on tablet show only 2 location, on mobile only montains, on top bar the nav-link should be centered on new line 
    - i wanna rotate logo-dice like as it bounces on the floor
- **Document Version**: 1.0
    - 1.0 first version of document (February 27, 2026)
- **Last Updated**: February 27, 2026
- **Status**: Complete ✅



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




