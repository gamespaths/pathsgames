package games.paths.core.port.match;

import java.util.List;
import java.util.Optional;

/**
 * KpiStorePort - v0.41.2 outbound port of system_kpi_daily: one upsert per counter, keyed by uuids
 * (no FK, decision 12), and the rows of a day range.
 */
public interface KpiStorePort {

    /** {@code INSERT ... ON CONFLICT (story_uuid, day, metric, ref_uuid) DO UPDATE SET value = value + delta}. */
    void increment(String storyUuid, String day, String metric, String refUuid, long delta);

    /** Every row with {@code from <= day <= to}; a null storyUuid reads every story. */
    List<KpiDailyRow> findRows(String storyUuid, String fromDay, String toDay);

    Optional<String> findStoryUuidByMatch(long idMatch);

    /** list_locations is keyed by (id, id_story). */
    Optional<String> findLocationUuid(long idStory, long idLocation);

    record KpiDailyRow(String storyUuid, String day, String metric, String refUuid, long value) {
    }
}
