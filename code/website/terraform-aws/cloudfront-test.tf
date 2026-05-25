# ==================================================
# CloudFront Distribution – Test (test.<domain_name>)
# ==================================================
# Reuses:
#   - ACM cert: aws_acm_certificate.website (SAN "*.${var.domain_name}" covers "test.${var.domain_name}")
#   - WAF:      aws_wafv2_web_acl.website (same web ACL as production)
#   - Security headers: aws_cloudfront_response_headers_policy.security (same CSP/SSM)
# Does NOT alias var.second_domain_name.
# ==================================================

# ==================================================
# CloudFront Origin Access Control – Test
# ==================================================

resource "aws_cloudfront_origin_access_control" "website_test" {
  name                              = "${var.test_bucket_name}-oac"
  description                       = "OAC for test.${var.domain_name} S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ==================================================
# CloudFront Distribution – Test
# ==================================================

resource "aws_cloudfront_distribution" "website_test" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Paths Games Test Website – test.${var.domain_name}"
  default_root_object = "index.html"
  aliases             = ["test.${var.domain_name}"]
  price_class         = "PriceClass_100" # US + Europe
  http_version        = "http2and3"
  web_acl_id          = var.enable_waf ? aws_wafv2_web_acl.website[0].arn : null

  origin {
    domain_name              = aws_s3_bucket.website_test.bucket_regional_domain_name
    origin_id                = "S3-${var.test_bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website_test.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.test_bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Managed caching policy – CachingOptimized
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # Security headers policy (shared with production)
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
    acm_certificate_arn      = aws_acm_certificate.website.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "test.${var.domain_name} Distribution"
  }
}
