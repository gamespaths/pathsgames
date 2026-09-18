locals {
  is_production = var.environment == "production"
  name_prefix   = "pathsgames-${var.environment}"

  # Shared resources are owned by production and read back by the other environments.
  certificate_arn = coalesce(
    one(aws_acm_certificate.website[*].arn),
    one(data.aws_acm_certificate.website[*].arn),
  )

  csp_ssm = {
    script  = coalesce(one(aws_ssm_parameter.csp_script_domains[*].value), one(data.aws_ssm_parameter.csp_script_domains[*].insecure_value))
    style   = coalesce(one(aws_ssm_parameter.csp_style_domains[*].value), one(data.aws_ssm_parameter.csp_style_domains[*].insecure_value))
    font    = coalesce(one(aws_ssm_parameter.csp_font_domains[*].value), one(data.aws_ssm_parameter.csp_font_domains[*].insecure_value))
    img     = coalesce(one(aws_ssm_parameter.csp_img_domains[*].value), one(data.aws_ssm_parameter.csp_img_domains[*].insecure_value))
    connect = coalesce(one(aws_ssm_parameter.csp_connect_domains[*].value), one(data.aws_ssm_parameter.csp_connect_domains[*].insecure_value))
  }
}
