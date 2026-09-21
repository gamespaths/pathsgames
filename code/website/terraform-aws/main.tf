terraform {
  required_version = ">= 1.10" # use_lockfile (S3 native state locking)

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # One state per environment: terraform init -backend-config=backend-<env>.hcl (see tf.sh)
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  # Same seven tags as the SAM backend stacks; Name is set per resource.
  default_tags {
    tags = {
      CostCenter  = "Paths.games"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "AlNao"
      Project     = "Paths.games.aws.websites"
      version     = var.project_version
    }
  }
}
