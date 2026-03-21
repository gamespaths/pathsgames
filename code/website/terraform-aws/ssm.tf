# ==================================================
# CSP Domain Lists – AWS SSM Parameter Store
# ==================================================
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
  name        = "/paths-games/csp/script-src"
  type        = "StringList"
  description = "CSP script-src – base domains (auto-expanded to https://domain and https://*.domain)"

  value = join(",", [
    "jsdelivr.net",          # Bootstrap JS
    "googletagmanager.com",  # Google Tag Manager
    "cdn-cookieyes.com",     # CookieYes cookie policy
  ])

  tags = var.tags
}

resource "aws_ssm_parameter" "csp_style_domains" {
  name        = "/paths-games/csp/style-src"
  type        = "StringList"
  description = "CSP style-src – base domains"

  value = join(",", [
    "googleapis.com",    # Google Fonts CSS
    "jsdelivr.net",      # Bootstrap CSS
    "cloudflare.com",    # Font Awesome
  ])

  tags = var.tags
}

resource "aws_ssm_parameter" "csp_font_domains" {
  name        = "/paths-games/csp/font-src"
  type        = "StringList"
  description = "CSP font-src – base domains"

  value = join(",", [
    "gstatic.com",    # Google Fonts files
    "cloudflare.com", # Font Awesome files
  ])

  tags = var.tags
}

resource "aws_ssm_parameter" "csp_img_domains" {
  name        = "/paths-games/csp/img-src"
  type        = "StringList"
  description = "CSP img-src – base domains (GTM/GA use 1x1 tracking pixels)"

  value = join(",", [
    "googletagmanager.com",  # GTM pixel
    "google-analytics.com",  # GA4 pixel
  ])

  tags = var.tags
}

resource "aws_ssm_parameter" "csp_connect_domains" {
  name        = "/paths-games/csp/connect-src"
  type        = "StringList"
  description = "CSP connect-src – base domains (fetch/XHR endpoints)"

  value = join(",", [
    "google-analytics.com",  # *.google-analytics.com covers region1.google-analytics.com
    "analytics.google.com",  # *.analytics.google.com covers region1.analytics.google.com
    "g.doubleclick.net",     # *.g.doubleclick.net covers stats.g.doubleclick.net
    "cookieyes.com",         # CookieYes consent manager
  ])

  tags = var.tags
}
