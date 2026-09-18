variable "environment" {
  description = "Deploy environment: picks the state backend, the tfvars file and the Environment tag"
  type        = string

  validation {
    condition     = contains(["test", "production"], var.environment)
    error_message = "environment must be \"test\" or \"production\"."
  }
}

variable "project_version" {
  description = "Project version, applied as the `version` tag (VERSION in the root .env, passed by tf.sh)"
  type        = string
}

variable "aws_region" {
  description = "AWS region of the resources (CloudFront + ACM require us-east-1)"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Primary domain name (shared ACM certificate: <domain> + *.<domain>)"
  type        = string
  default     = "paths.games"
}

variable "second_domain_name" {
  description = "Secondary domain name, added to the production certificate as SAN"
  type        = string
  default     = "pathsgames.com"
}

variable "bucket_name" {
  description = "S3 bucket of the static site (pathsgames-com in production, pathsgames-com-<env> elsewhere)"
  type        = string
}

variable "bucket_force_destroy" {
  description = "Allow terraform destroy to empty the bucket first (test only, never in production)"
  type        = bool
  default     = false
}

variable "aliases" {
  description = "CloudFront aliases; the first one is the canonical site URL"
  type        = list(string)

  validation {
    condition     = length(var.aliases) > 0
    error_message = "aliases must contain at least one domain."
  }
}

variable "enable_waf" {
  description = "Enable WAF v2 Web ACL on CloudFront (has additional cost)"
  type        = bool
  default     = false
}

variable "csp_mode" {
  description = <<-EOT
    Content Security Policy mode:
      "open"       – allows all origins (default, useful for development/debugging)
      "restricted" – allowlist loaded from SSM Parameter Store (/paths-games/csp/*)
  EOT
  type        = string
  default     = "open"

  validation {
    condition     = contains(["open", "restricted"], var.csp_mode)
    error_message = "csp_mode must be either \"open\" or \"restricted\"."
  }
}

variable "csp_extra_domains" {
  description = "Extra CSP base domains per directive (script, style, font, img, connect), added to the shared SSM lists; e.g. the API and Turnstile hosts of a react-game environment"
  type        = map(list(string))
  default     = {}
}
