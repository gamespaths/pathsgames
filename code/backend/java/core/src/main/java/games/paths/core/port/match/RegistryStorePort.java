package games.paths.core.port.match;

import java.util.List;

/**
 * RegistryStorePort - the only door to {@code gaming_state_registry}. Step 36 consolidated
 * five hand-rolled readers and four writers behind it; rows cross as a record, not a JPA entity.
 */
public interface RegistryStorePort {

    /**
     * One row of the match registry — one VALUE of one key. {@code stringValue} and
     * {@code intValue} are never both set. A single-valued key owns exactly one row; a
     * multi-valued one owns a row per member, and none at all when its set is empty.
     */
    record RegistryRow(Long id, String uuid, String key, String stringValue, Integer intValue,
                       Long idCharacter, Long idEvent, Long idChoice, Integer clock,
                       Integer multiValue) {

        public static RegistryRow of(String key, String stringValue, Integer intValue) {
            return new RegistryRow(null, null, key, stringValue, intValue,
                    null, null, null, null, 0);
        }

        public static RegistryRow of(String key, String stringValue, Integer intValue,
                                     boolean multi) {
            return new RegistryRow(null, null, key, stringValue, intValue,
                    null, null, null, null, multi ? 1 : 0);
        }

        public boolean isMulti() {
            return multiValue != null && multiValue != 0;
        }
    }

    List<RegistryRow> findByMatch(long idMatch);

    /** Every row of one key: one for a single key, N for a multi-valued one, none when empty. */
    List<RegistryRow> findByMatchAndKey(long idMatch, String key);

    /** Replace the one row of a SINGLE key. The id and uuid of a new row are minted here. */
    void upsert(long idMatch, String key, String stringValue, Integer intValue,
                Long idCharacter, Long idEvent, Long idChoice, Integer clock);

    /** Add one member to a MULTI key. The caller has already ruled out a duplicate. */
    void insertValue(long idMatch, String key, String stringValue, Integer intValue,
                     Long idCharacter, Long idEvent, Long idChoice, Integer clock);

    /** Delete the row holding one member of a MULTI key. */
    void deleteValue(long idMatch, String key, String stringValue, Integer intValue);

    /** Bulk insert used only by match creation, where ids start at 1. */
    void insertAll(long idMatch, List<RegistryRow> rows);

    void deleteByMatchIdIn(List<Long> matchIds);

    /** Audit row on {@code log_events}; the message carries the key and the two values. */
    void logChange(long idMatch, Long idCharacter, Long idEvent, Long idChoice, Integer clock,
                   String message);
}
