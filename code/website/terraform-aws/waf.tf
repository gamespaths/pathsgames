# ==================================================
# WAF v2 – Web Application Firewall
# ==================================================

resource "aws_wafv2_web_acl" "website" {
  count       = var.enable_waf ? 1 : 0

  name        = "paths-games-waf"
  description = "WAF for ${var.domain_name} CloudFront distribution"
  scope       = "CLOUDFRONT" # Must be in us-east-1

  default_action {
    allow {}
  }

  # Rate limiting – block IPs sending > 1000 requests in 5 minutes
  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 1000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "PathsGamesRateLimit"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules – Common Rule Set (OWASP Top 10)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "PathsGamesCommonRules"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules – Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "PathsGamesKnownBadInputs"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules – Bot Control (optional, has extra cost)
  # rule {
  #   name     = "AWSManagedRulesBotControlRuleSet"
  #   priority = 4
  #
  #   override_action {
  #     none {}
  #   }
  #
  #   statement {
  #     managed_rule_group_statement {
  #       name        = "AWSManagedRulesBotControlRuleSet"
  #       vendor_name = "AWS"
  #     }
  #   }
  #
  #   visibility_config {
  #     cloudwatch_metrics_enabled = true
  #     metric_name                = "PathsGamesBotControl"
  #     sampled_requests_enabled   = true
  #   }
  # }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "PathsGamesWAF"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${var.domain_name} WAF"
  }
}
