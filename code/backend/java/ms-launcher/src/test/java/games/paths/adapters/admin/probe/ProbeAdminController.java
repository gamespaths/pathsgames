package games.paths.adapters.admin.probe;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** v1.10.0 test-only admin controller (its package makes it an admin handler for the interceptor). */
@RestController
public class ProbeAdminController {

    @GetMapping("/api/admin/probe")
    public String probe() {
        return "admin";
    }
}
