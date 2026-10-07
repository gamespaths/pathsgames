environment          = "production"
bucket_name          = "pathsgames-com"
aliases              = ["paths.games", "www.paths.games", "pathsgames.com", "www.pathsgames.com"]
bucket_force_destroy = false
enable_waf           = false
csp_mode             = "restricted"

# v0.42.0 — react-game at the bucket root (landing retired): alpha API, Turnstile (script + iframe), Unsplash art, jsDelivr source maps.
csp_extra_domains = {
  connect = ["api-alpha.paths.games", "cdn.jsdelivr.net"]
  script  = ["challenges.cloudflare.com"]
  img     = ["unsplash.com"]
  frame   = ["challenges.cloudflare.com"]
}

# v0.42.0 — pathsgames.com and www.pathsgames.com answer 301 to https://paths.games.
redirect_target_host = "paths.games"
