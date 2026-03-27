package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;
import games.paths.core.port.auth.GuestAdminPersistencePort;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * GuestAdminPersistenceAdapter - Database adapter for admin-level guest queries.
 * Uses Spring Data JPA repositories. Operates on the users and users_tokens tables.
 */
@Repository
@Transactional
public class GuestAdminPersistenceAdapter implements GuestAdminPersistencePort {

    private static final int GUEST_STATE = 6;

    private final UserRepository userRepository;
    private final UserTokenRepository userTokenRepository;

    public GuestAdminPersistenceAdapter(UserRepository userRepository, UserTokenRepository userTokenRepository) {
        this.userRepository = userRepository;
        this.userTokenRepository = userTokenRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> findAllGuests() {
        List<UserEntity> guests = userRepository.findByStateOrderByTsRegistrationDesc(GUEST_STATE);
        return guests.stream()
                .map(this::toMap)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> findGuestByUuid(String uuid) {
        Optional<UserEntity> opt = userRepository.findByUuidAndState(uuid, GUEST_STATE);
        return opt.map(this::toMap).orElse(null);
    }

    @Override
    public boolean deleteGuestByUuid(String uuid) {
        Optional<UserEntity> opt = userRepository.findByUuidAndState(uuid, GUEST_STATE);
        if (opt.isEmpty()) {
            return false;
        }

        UserEntity user = opt.get();

        // Delete associated tokens first
        userTokenRepository.deleteByIdUser(user.getId());

        // Delete the guest user
        userRepository.delete(user);
        return true;
    }

    @Override
    public int deleteExpiredGuests() {
        String now = Instant.now().toString();
        userTokenRepository.deleteTokensOfExpiredGuests(GUEST_STATE, now);
        return userRepository.deleteExpiredGuests(GUEST_STATE, now);
    }

    @Override
    @Transactional(readOnly = true)
    public long countAllGuests() {
        return userRepository.countByState(GUEST_STATE);
    }

    @Override
    @Transactional(readOnly = true)
    public long countActiveGuests() {
        String now = Instant.now().toString();
        return userRepository.countActiveGuests(GUEST_STATE, now);
    }

    @Override
    @Transactional(readOnly = true)
    public long countExpiredGuests() {
        String now = Instant.now().toString();
        return userRepository.countExpiredGuests(GUEST_STATE, now);
    }

    private Map<String, Object> toMap(UserEntity user) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("uuid", user.getUuid());
        map.put("username", user.getUsername());
        map.put("nickname", user.getNickname());
        map.put("role", user.getRole());
        map.put("state", user.getState());
        map.put("language", user.getLanguage());
        map.put("guestCookieToken", user.getGuestCookieToken());
        map.put("guestExpiresAt", user.getGuestExpiresAt());
        map.put("tsRegistration", user.getTsRegistration());
        map.put("tsLastAccess", user.getTsLastAccess());
        return map;
    }
}
