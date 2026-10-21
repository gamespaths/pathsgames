package games.paths.core.service.auth;

import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.UserStatePort;

import java.time.Clock;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * UserStateService - v1.2.0 role and state of a token's user, one query per user every 60 seconds;
 * evict() drops a user at a state change so a ban or a deletion is refused at once.
 */
public class UserStateService implements UserStatePort {

    public static final long DEFAULT_TTL_MILLIS = 60_000L;
    private static final int SWEEP_ABOVE = 10_000;

    private final IdentityPersistencePort persistence;
    private final long ttlMillis;
    private final Clock clock;
    private final Map<String, Entry> cache = new ConcurrentHashMap<>();

    public UserStateService(IdentityPersistencePort persistence) {
        this(persistence, DEFAULT_TTL_MILLIS, Clock.systemUTC());
    }

    public UserStateService(IdentityPersistencePort persistence, long ttlMillis, Clock clock) {
        this.persistence = persistence;
        this.ttlMillis = ttlMillis;
        this.clock = clock;
    }

    @Override
    public Optional<UserStatus> current(String userUuid) {
        if (userUuid == null || userUuid.isBlank()) {
            return Optional.empty();
        }
        long now = clock.millis();
        Entry hit = cache.get(userUuid);
        if (hit != null && now - hit.loadedAt < ttlMillis) {
            return Optional.ofNullable(hit.status);
        }
        Optional<UserStatus> loaded = persistence.findUserByUuid(userUuid);
        if (cache.size() > SWEEP_ABOVE) {
            cache.entrySet().removeIf(e -> now - e.getValue().loadedAt >= ttlMillis);
        }
        cache.put(userUuid, new Entry(loaded.orElse(null), now));
        return loaded;
    }

    @Override
    public void evict(String userUuid) {
        if (userUuid != null) {
            cache.remove(userUuid);
        }
    }

    private record Entry(UserStatus status, long loadedAt) {
    }
}
