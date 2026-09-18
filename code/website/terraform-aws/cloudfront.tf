# ==================================================
# ACM Certificate – SSL/TLS for paths.games
# ==================================================
# Owned by production (covers *.paths.games, so every <env>.paths.games);
# the other environments look it up instead of issuing their own.

resource "aws_acm_certificate" "website" {
  count = local.is_production ? 1 : 0

  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}", "*.${var.second_domain_name}", var.second_domain_name]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${local.name_prefix}-Certificate"
  }
}

data "aws_acm_certificate" "website" {
  count = local.is_production ? 0 : 1

  domain      = var.domain_name
  statuses    = ["ISSUED"]
  most_recent = true
}

# ==================================================
# CloudFront Origin Access Control
# ==================================================

resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${var.bucket_name}-oac"
  description                       = "OAC for ${var.aliases[0]} S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ==================================================
# CloudFront Distribution
# ==================================================

resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Paths Games Website – ${var.aliases[0]}"
  default_root_object = "index.html"
  aliases             = var.aliases
  price_class         = "PriceClass_100" # US + Europe
  http_version        = "http2and3"
  web_acl_id          = var.enable_waf ? aws_wafv2_web_acl.website[0].arn : null

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-${var.bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Managed caching policy – CachingOptimized
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # Security headers policy
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # SPA fallback – serve index.html for 404s
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "blacklist"
      locations        = ["RU", "BY", "CN"]
    }
  }

  viewer_certificate {
    acm_certificate_arn      = local.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "${local.name_prefix}-Distribution"
  }
}

# ==================================================
# Content Security Policy – domain expansion from SSM
# ==================================================
#
# Each base domain (shared SSM lists + var.csp_extra_domains) is expanded into two origins:
#   "example.com" → "https://example.com" + "https://*.example.com"
# Special values ('self', 'unsafe-inline', data:) are hardcoded
# below because they are not domains and do not belong in SSM.
# ==================================================

locals {
  _expand = { for k, v in local.csp_ssm :
    k => flatten([for d in concat(split(",", v), lookup(var.csp_extra_domains, k, [])) : ["https://${trimspace(d)}", "https://*.${trimspace(d)}"]])
  }

  csp_script_src  = concat(["'self'"], local._expand["script"])
  csp_style_src   = concat(["'self'", "'unsafe-inline'"], local._expand["style"])
  csp_font_src    = concat(["'self'"], local._expand["font"])
  csp_img_src     = concat(["'self'", "data:"], local._expand["img"])
  csp_connect_src = concat(["'self'"], local._expand["connect"])

  csp_header_restricted = join("; ", [
    "default-src 'self'",
    "script-src ${join(" ", local.csp_script_src)}",
    "style-src ${join(" ", local.csp_style_src)}",
    "font-src ${join(" ", local.csp_font_src)}",
    "img-src ${join(" ", local.csp_img_src)}",
    "connect-src ${join(" ", local.csp_connect_src)}",
  ])

  csp_header_open = "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; font-src *; img-src * data:; connect-src *"

  csp_header = var.csp_mode == "restricted" ? local.csp_header_restricted : local.csp_header_open
}

# ==================================================
# CloudFront Security Headers Policy (one per environment)
# ==================================================

resource "aws_cloudfront_response_headers_policy" "security" {
  # production keeps the historical name; every other environment gets a suffix.
  name    = local.is_production ? "paths-games-security-headers" : "paths-games-security-headers-${var.environment}"
  comment = "Security headers for ${var.aliases[0]}"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    content_security_policy {
      content_security_policy = local.csp_header
      override                = true
    }
  }
}
