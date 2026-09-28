environment          = "test"
bucket_name          = "pathsgames-com-test"
aliases              = ["test.paths.games"]
bucket_force_destroy = true
enable_waf           = false
csp_mode             = "restricted"

# react-game on test: the test APIs, Cloudflare Turnstile (script + iframe) and the Unsplash hero image (v0.41.0).
csp_extra_domains = {
  connect = ["api-test.paths.games", "api-test-server2.paths.games", "api-test-server3.paths.games", "cdn.jsdelivr.net"]
  script  = ["challenges.cloudflare.com"]
  img     = ["unsplash.com"]
  frame   = ["challenges.cloudflare.com"]
}
