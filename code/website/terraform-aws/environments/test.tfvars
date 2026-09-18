environment          = "test"
bucket_name          = "pathsgames-com-test"
aliases              = ["test.paths.games"]
bucket_force_destroy = true
enable_waf           = false
csp_mode             = "open"

# Only used when csp_mode = "restricted": react-game calls the test APIs and Cloudflare Turnstile.
csp_extra_domains = {
  connect = ["api-test.paths.games", "api-test-server2.paths.games", "api-test-server3.paths.games"]
  script  = ["challenges.cloudflare.com"]
}
