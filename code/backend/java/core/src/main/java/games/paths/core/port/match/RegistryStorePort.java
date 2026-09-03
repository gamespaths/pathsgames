package games.paths.core.port.match;

import java.util.List;
import java.util.Optional;

/**
 * RegistryStorePort - the only door to {@code gaming_state_registry}. Step 36 consolidated
 * five hand-rolled readers and four writers behind it; rows cross as a record, not a JPA entity.
 */
public interface RegistryStorePort {

    /** One row of the match registry. {@code stringValue} and {@code intValue} are never both set. */
    record RegistryRow(Long id, String uuid, String key, String stringValue, Integer intValue,
                       Long idCharacter, Long idEvent, Long idChoice, Integer clock) {

        public static RegistryRow of(String key, String stringValue, Integer intValue) {
            return new RegistryRow(null, null, key, stringValue, intValue, null, null, null, null);
        }
    }

    List<RegistryRow> findByMatch(long idMatch);

    Optional<RegistryRow> findByMatchAndKey(long idMatch, String key);

    /** Insert or overwrite one key. The id and uuid of a new row are minted by the adapter. */
    void upsert(long idMatch, String key, String stringValue, Integer intValue,
                Long idCharacter, Long idEvent, Long idChoice, Integer clock);

    /** Bulk insert used only by match creation, where ids start at 1. */
    void insertAll(long idMatch, List<RegistryRow> rows);

    void deleteByMatchIdIn(List<Long> matchIds);

    /** Audit row on {@code log_events}; the message carries the key and the two values. */
    void logChange(long idMatch, Long idCharacter, Long idEvent, Long idChoice, Integer clock,
                   String message);
}
