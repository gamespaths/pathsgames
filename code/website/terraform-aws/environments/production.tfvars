environment          = "production"
bucket_name          = "pathsgames-com"
aliases              = ["paths.games", "www.paths.games", "pathsgames.com", "www.pathsgames.com"]
bucket_force_destroy = false
enable_waf           = false
csp_mode             = "restricted"

# v0.41.2 — static site code/website/html: Unsplash hero image (landing.css) and the jsDelivr source maps, as on test.
csp_extra_domains = {
  connect = ["cdn.jsdelivr.net"]
  img     = ["unsplash.com"]
}
