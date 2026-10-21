package games.paths.launcher.config;

import games.paths.core.model.auth.AdminBootstrapResult;
import games.paths.core.port.auth.AdminBootstrapPort;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.PrintStream;

/**
 * AdminCreateRunner - v1.2.0 {@code --paths.admin.create=<nickname>}: creates the admin user, prints user
 * and token on stdout only (never a log), and the launcher exits without starting the web server.
 */
@Component
@ConditionalOnProperty("paths.admin.create")
public class AdminCreateRunner implements ApplicationRunner {

    public static final String ARGUMENT = "--paths.admin.create=";

    private final AdminBootstrapPort adminBootstrapPort;
    private final PrintStream out;

    @org.springframework.beans.factory.annotation.Autowired
    public AdminCreateRunner(AdminBootstrapPort adminBootstrapPort) {
        this(adminBootstrapPort, System.out);
    }

    AdminCreateRunner(AdminBootstrapPort adminBootstrapPort, PrintStream out) {
        this.adminBootstrapPort = adminBootstrapPort;
        this.out = out;
    }

    @Override
    public void run(ApplicationArguments args) {
        String nickname = args.getOptionValues("paths.admin.create").get(0);
        AdminBootstrapResult admin = adminBootstrapPort.createAdmin(nickname);
        out.println("ADMIN_USER_UUID=" + admin.userUuid());
        out.println("ADMIN_USERNAME=" + admin.username());
        out.println("ADMIN_NICKNAME=" + admin.nickname());
        out.println("ADMIN_CREATED=" + admin.created());
        out.println("ADMIN_TOKEN_EXPIRES_AT=" + java.time.Instant.ofEpochMilli(admin.expiresAt()));
        out.println("ADMIN_TOKEN=" + admin.accessToken());
    }

    /** True when the launcher runs as the admin bootstrap tool. */
    public static boolean requested(String[] args) {
        if (args == null) {
            return false;
        }
        for (String arg : args) {
            if (arg != null && arg.startsWith(ARGUMENT)) {
                return true;
            }
        }
        return false;
    }
}
