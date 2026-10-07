# ==================================================
# CSP Domain Lists – AWS SSM Parameter Store
# ==================================================
# Owned by production; every other environment reads them with the data sources below.
#
# Add base domains here (no protocol, no wildcard).
# Terraform will automatically expand each "example.com" into:
#   → https://example.com
#   → https://*.example.com
#
# NOTE: CSP wildcards cover only one subdomain level.
# For "stats.g.doubleclick.net" register "g.doubleclick.net"
# so that *.g.doubleclick.net covers stats.g.doubleclick.net.
#
# Special values ('self', 'unsafe-inline', data:) do NOT belong here:
# they are hardcoded in cloudfront.tf because they are not domains.
# ==================================================

resource "aws_ssm_parameter" "csp_script_domains" {
  count = local.is_production ? 1 : 0

  name        = "/paths-games/csp/script-src"
  type        = "StringList"
  description = "CSP script-src – base domains (auto-expanded to https://domain and https://*.domain)"

  value = join(",", [
    "jsdelivr.net",          # Bootstrap JS
    "googletagmanager.com",  # Google Tag Manager
  ])

  tags = {
    Name = "/paths-games/csp/script-src"
  }
}

resource "aws_ssm_parameter" "csp_style_domains" {
  count = local.is_production ? 1 : 0

  name        = "/paths-games/csp/style-src"
  type        = "StringList"
  description = "CSP style-src – base domains"

  value = join(",", [
    "googleapis.com",    # Google Fonts CSS
    "jsdelivr.net",      # Bootstrap CSS
    "cloudflare.com",    # Font Awesome
  ])

  tags = {
    Name = "/paths-games/csp/style-src"
  }
}

resource "aws_ssm_parameter" "csp_font_domains" {
  count = local.is_production ? 1 : 0

  name        = "/paths-games/csp/font-src"
  type        = "StringList"
  description = "CSP font-src – base domains"

  value = join(",", [
    "gstatic.com",    # Google Fonts files
    "cloudflare.com", # Font Awesome files
  ])

  tags = {
    Name = "/paths-games/csp/font-src"
  }
}

resource "aws_ssm_parameter" "csp_img_domains" {
  count = local.is_production ? 1 : 0

  name        = "/paths-games/csp/img-src"
  type        = "StringList"
  description = "CSP img-src – base domains (GTM/GA use 1x1 tracking pixels)"

  value = join(",", [
    "googletagmanager.com",  # GTM pixel
    "google-analytics.com",  # GA4 pixel
  ])

  tags = {
    Name = "/paths-games/csp/img-src"
  }
}

resource "aws_ssm_parameter" "csp_connect_domains" {
  count = local.is_production ? 1 : 0

  name        = "/paths-games/csp/connect-src"
  type        = "StringList"
  description = "CSP connect-src – base domains (fetch/XHR endpoints)"

  value = join(",", [
    "google-analytics.com",  # *.google-analytics.com covers region1.google-analytics.com
    "analytics.google.com",  # *.analytics.google.com covers region1.analytics.google.com
    "g.doubleclick.net",     # *.g.doubleclick.net covers stats.g.doubleclick.net
  ])

  tags = {
    Name = "/paths-games/csp/connect-src"
  }
}

# ==================================================
# Read-only view for the non-production environments
# ==================================================

data "aws_ssm_parameter" "csp_script_domains" {
  count = local.is_production ? 0 : 1

  name = "/paths-games/csp/script-src"
}

data "aws_ssm_parameter" "csp_style_domains" {
  count = local.is_production ? 0 : 1

  name = "/paths-games/csp/style-src"
}

data "aws_ssm_parameter" "csp_font_domains" {
  count = local.is_production ? 0 : 1

  name = "/paths-games/csp/font-src"
}

data "aws_ssm_parameter" "csp_img_domains" {
  count = local.is_production ? 0 : 1

  name = "/paths-games/csp/img-src"
}

data "aws_ssm_parameter" "csp_connect_domains" {
  count = local.is_production ? 0 : 1

  name = "/paths-games/csp/connect-src"
}
