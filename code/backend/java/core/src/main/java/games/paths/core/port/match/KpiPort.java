package games.paths.core.port.match;

import java.util.List;

/**
 * KpiPort - v0.41.2 Step 41 F: daily UTC counters per story written at event time (best effort,
 * never failing the action) and the admin report over them (decisions 12, 13, 44).
 */
public interface KpiPort {

    /** The counters of system_kpi_daily; the last four carry a ref uuid. */
    enum Metric {
        MATCH_STARTED, MATCH_COMPLETED, DURATION_MS, DURATION_CLOCKS, COMA,
        CHOICE, LOCATION_VISIT, MISSION_ACTIVE, MISSION_COMPLETED, MISSION_FAILED
    }

    String GROUP_DAY = "day";
    String GROUP_MONTH = "month";
    String GROUP_TOTAL = "total";
    int DEFAULT_DAYS = 30;
    int MAX_DAYS = 366;

    /** Adds {@code delta} to today's (UTC) counter; a failure is logged and swallowed. */
    void record(String storyUuid, Metric metric, String refUuid, long delta);

    /** Same as {@link #record}, the story found through the match. */
    void recordForMatch(long idMatch, Metric metric, String refUuid, long delta);

    /** LOCATION_VISIT of a location entered for the first time in the match. */
    void recordLocationVisit(long idMatch, long idStory, long idLocation);

    /** The report; blank storyUuid = every story summed; throws {@link KpiException} on bad input. */
    KpiReport report(String storyUuid, String from, String to, String groupBy);

    record KpiRow(String period, long matchesStarted, long matchesCompleted, Double completionRate,
                  Double avgDurationMinutes, Double avgDurationClocks, long comaCount) {
    }

    record KpiCount(String uuid, long count) {
    }

    record KpiMission(String uuid, long activated, long completed, long failed) {
    }

    record KpiReport(String storyUuid, String from, String to, String groupBy, List<KpiRow> rows,
                     List<KpiCount> choices, List<KpiCount> locations, List<KpiMission> missions) {
    }

    /** Bad query parameters: 400 INVALID_INPUT. */
    class KpiException extends RuntimeException {
        public static final String INVALID_INPUT = "INVALID_INPUT";

        public KpiException(String message) {
            super(message);
        }

        public String getCode() {
            return INVALID_INPUT;
        }
    }
}
