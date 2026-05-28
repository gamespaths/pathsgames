#!/bin/bash

# Configurazione nomi (come da variabili Terraform)
DOMAIN="paths.games"
BUCKET="pathsgames-com"
OAC_NAME="pathsgames-com-oac"
POLICY_NAME="paths-games-security-headers"

echo "🔍 Recupero ID dinamici da AWS..."

# 1. Recupero CloudFront Distribution ID
CF_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '$DOMAIN')].Id" --output text)

# 2. Recupero Origin Access Control ID
OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='$OAC_NAME'].Id" --output text)

# 3. Recupero ACM Certificate ARN
ACM_ARN=$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn" --output text)

# 4. Recupero Response Headers Policy ID
POLICY_ID=$(aws cloudfront list-response-headers-policies --type custom --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='$POLICY_NAME'].ResponseHeadersPolicy.Id" --output text)

echo "✅ CloudFront ID: $CF_ID"
echo "✅ OAC ID:        $OAC_ID"
echo "✅ ACM ARN:       $ACM_ARN"
echo "✅ Policy ID:     $POLICY_ID"
echo "------------------------------------------"

# Controllo che gli ID siano stati trovati
if [ -z "$CF_ID" ] || [ -z "$OAC_ID" ] || [ -z "$ACM_ARN" ] || [ -z "$POLICY_ID" ]; then
    echo "❌ Errore: Impossibile trovare uno o più ID su AWS. Verifica i permessi e i nomi."
    exit 1
fi

echo "🚀 Avvio importazione in Terraform..."

# Import S3 Bucket e configurazioni correlate
terraform import aws_s3_bucket.website "$BUCKET"
terraform import aws_s3_bucket_public_access_block.website "$BUCKET"
terraform import aws_s3_bucket_server_side_encryption_configuration.website "$BUCKET"
terraform import aws_s3_bucket_versioning.website "$BUCKET"
terraform import aws_s3_bucket_policy.website "$BUCKET"

# Import CloudFront e Certificato usando le variabili dinamiche
terraform import aws_cloudfront_distribution.website "$CF_ID"
terraform import aws_cloudfront_origin_access_control.website "$OAC_ID"
terraform import aws_acm_certificate.website "$ACM_ARN"
terraform import aws_cloudfront_response_headers_policy.security "$POLICY_ID"

# Import SSM Parameters (CSP)
terraform import aws_ssm_parameter.csp_script_domains /paths-games/csp/script-src
terraform import aws_ssm_parameter.csp_style_domains /paths-games/csp/style-src
terraform import aws_ssm_parameter.csp_font_domains /paths-games/csp/font-src
terraform import aws_ssm_parameter.csp_img_domains /paths-games/csp/img-src
terraform import aws_ssm_parameter.csp_connect_domains /paths-games/csp/connect-src

echo "✨ Importazione completata!"
