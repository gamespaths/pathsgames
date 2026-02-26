variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1" # Required for CloudFront + ACM
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "paths.games"
}

variable "second_domain_name" {
  description = "Secondary domain name (alias)"
  type        = string
  default     = "pathsgames.com"
}

variable "bucket_name" {
  description = "S3 bucket name for static website"
  type        = string
  default     = "pathsgames-com"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "production"
}

variable "enable_waf" {
  description = "Enable WAF v2 Web ACL on CloudFront (has additional cost)"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "PathsGames"
    ManagedBy   = "Terraform"
  }
}
