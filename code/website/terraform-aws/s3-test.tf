# ==================================================
# S3 Bucket – Test Static Website Hosting (test.<domain_name>)
# ==================================================

resource "aws_s3_bucket" "website_test" {
  bucket = var.test_bucket_name

  tags = {
    Name = "test.${var.domain_name} Website"
  }
}

# Block ALL public access – content served only via CloudFront
resource "aws_s3_bucket_public_access_block" "website_test" {
  bucket = aws_s3_bucket.website_test.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Encryption at rest
resource "aws_s3_bucket_server_side_encryption_configuration" "website_test" {
  bucket = aws_s3_bucket.website_test.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Versioning for rollback safety
resource "aws_s3_bucket_versioning" "website_test" {
  bucket = aws_s3_bucket.website_test.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Bucket policy – allow only CloudFront OAC (test distribution)
resource "aws_s3_bucket_policy" "website_test" {
  bucket = aws_s3_bucket.website_test.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.website_test.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.website_test.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.website_test]
}
