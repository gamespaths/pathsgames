package games.paths.core.service.match;

import games.paths.core.port.match.KpiPort;
import games.paths.core.port.match.KpiStorePort;
import games.paths.core.port.match.KpiStorePort.KpiDailyRow;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;

/**
 * KpiService - v0.41.2 Step 41 F: counters at event time (a failure is logged, never thrown) and the
 * day/month/total report; counters are never rolled back by a snapshot restore (decision 44).
 */
public class KpiService implements KpiPort {

    private static final System.Logger LOG = System.getLogger(KpiService.class.getName());
    private static final Pattern DAY = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
    private static final String TOTAL_PERIOD = "total";

    private final KpiStorePort store;
    private final Clock clock;

    public KpiService(KpiStorePort store) {
        this(store, Clock.systemUTC());
    }

    public KpiService(KpiStorePort store, Clock clock) {
        this.store = store;
        this.clock = clock.withZone(ZoneOffset.UTC);
    }

    @Override
    public void record(String storyUuid, Metric metric, String refUuid, long delta) {
        if (storyUuid == null || storyUuid.isBlank() || metric == null || delta == 0) {
            return;
        }
        try {
            store.increment(storyUuid, today().toString(), metric.name(), refUuid == null ? "" : refUuid, delta);
        } catch (RuntimeException ex) {
            LOG.log(System.Logger.Level.WARNING, "KPI_RECORD_FAILED story={0} metric={1}: {2}",
                    storyUuid, metric, ex.getMessage());
        }
    }

    @Override
    public void recordForMatch(long idMatch, Metric metric, String refUuid, long delta) {
        try {
            store.findStoryUuidByMatch(idMatch).ifPresent(story -> record(story, metric, refUuid, delta));
        } catch (RuntimeException ex) {
            LOG.log(System.Logger.Level.WARNING, "KPI_RECORD_FAILED match={0} metric={1}: {2}",
                    idMatch, metric, ex.getMessage());
        }
    }

    @Override
    public void recordLocationVisit(long idMatch, long idStory, long idLocation) {
        try {
            store.findLocationUuid(idStory, idLocation)
                    .ifPresent(uuid -> recordForMatch(idMatch, Metric.LOCATION_VISIT, uuid, 1));
        } catch (RuntimeException ex) {
            LOG.log(System.Logger.Level.WARNING, "KPI_RECORD_FAILED match={0} location={1}: {2}",
                    idMatch, idLocation, ex.getMessage());
        }
    }

    @Override
    public KpiReport report(String storyUuid, String from, String to, String groupBy) {
        String group = groupBy == null || groupBy.isBlank() ? GROUP_DAY : groupBy.trim().toLowerCase(Locale.ROOT);
        if (!List.of(GROUP_DAY, GROUP_MONTH, GROUP_TOTAL).contains(group)) {
            throw new KpiException("groupBy must be day, month or total");
        }
        LocalDate toDay = isBlank(to) ? today() : parseDay("to", to);
        LocalDate fromDay = isBlank(from) ? toDay.minusDays(DEFAULT_DAYS - 1L) : parseDay("from", from);
        if (fromDay.isAfter(toDay)) {
            throw new KpiException("from must not be after to");
        }
        if (ChronoUnit.DAYS.between(fromDay, toDay) + 1 > MAX_DAYS) {
            throw new KpiException("The range may span at most " + MAX_DAYS + " days");
        }
        String story = isBlank(storyUuid) ? null : storyUuid.trim();
        List<KpiDailyRow> rows = store.findRows(story, fromDay.toString(), toDay.toString());

        Map<String, long[]> periods = emptyPeriods(fromDay, toDay, group);
        Map<String, Long> choices = new TreeMap<>();
        Map<String, Long> locations = new TreeMap<>();
        Map<String, long[]> missions = new TreeMap<>();
        for (KpiDailyRow r : rows) {
            long[] p = periods.get(periodOf(r.day(), group));
            Metric metric = metricOf(r.metric());
            if (p == null || metric == null) {
                continue;
            }
            accumulate(metric, r, p, choices, locations, missions);
        }
        List<KpiRow> out = new ArrayList<>();
        periods.forEach((period, p) -> out.add(toRow(period, p)));
        return new KpiReport(story, fromDay.toString(), toDay.toString(), group, out,
                counts(choices), counts(locations), missionList(missions));
    }

    private static void accumulate(Metric metric, KpiDailyRow r, long[] p, Map<String, Long> choices,
                                   Map<String, Long> locations, Map<String, long[]> missions) {
        String ref = r.refUuid() == null ? "" : r.refUuid();
        switch (metric) {
            case MATCH_STARTED -> p[0] += r.value();
            case MATCH_COMPLETED -> p[1] += r.value();
            case DURATION_MS -> p[2] += r.value();
            case DURATION_CLOCKS -> p[3] += r.value();
            case COMA -> p[4] += r.value();
            case CHOICE -> choices.merge(ref, r.value(), Long::sum);
            case LOCATION_VISIT -> locations.merge(ref, r.value(), Long::sum);
            case MISSION_ACTIVE -> missions.computeIfAbsent(ref, k -> new long[3])[0] += r.value();
            case MISSION_COMPLETED -> missions.computeIfAbsent(ref, k -> new long[3])[1] += r.value();
            case MISSION_FAILED -> missions.computeIfAbsent(ref, k -> new long[3])[2] += r.value();
        }
    }

    private static KpiRow toRow(String period, long[] p) {
        Double rate = p[0] == 0 ? null : ratio(p[1], p[0], 4);
        Double minutes = p[1] == 0 ? null : ratio(p[2], p[1] * 60_000L, 2);
        Double clocks = p[1] == 0 ? null : ratio(p[3], p[1], 2);
        return new KpiRow(period, p[0], p[1], rate, minutes, clocks, p[4]);
    }

    static Double ratio(long numerator, long denominator, int scale) {
        return BigDecimal.valueOf(numerator)
                .divide(BigDecimal.valueOf(denominator), scale, RoundingMode.HALF_UP).doubleValue();
    }

    private static Map<String, long[]> emptyPeriods(LocalDate from, LocalDate to, String group) {
        Map<String, long[]> periods = new LinkedHashMap<>();
        if (GROUP_TOTAL.equals(group)) {
            periods.put(TOTAL_PERIOD, new long[5]);
        } else if (GROUP_MONTH.equals(group)) {
            for (YearMonth m = YearMonth.from(from); !m.isAfter(YearMonth.from(to)); m = m.plusMonths(1)) {
                periods.put(m.toString(), new long[5]);
            }
        } else {
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                periods.put(d.toString(), new long[5]);
            }
        }
        return periods;
    }

    private static String periodOf(String day, String group) {
        if (day == null) {
            return "";
        }
        if (GROUP_TOTAL.equals(group)) {
            return TOTAL_PERIOD;
        }
        return GROUP_MONTH.equals(group) && day.length() >= 7 ? day.substring(0, 7) : day;
    }

    private static Metric metricOf(String name) {
        try {
            return name == null ? null : Metric.valueOf(name);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static List<KpiCount> counts(Map<String, Long> byUuid) {
        List<KpiCount> out = new ArrayList<>();
        byUuid.forEach((uuid, count) -> out.add(new KpiCount(uuid, count)));
        out.sort(Comparator.comparingLong(KpiCount::count).reversed().thenComparing(KpiCount::uuid));
        return out;
    }

    private static List<KpiMission> missionList(Map<String, long[]> byUuid) {
        List<KpiMission> out = new ArrayList<>();
        byUuid.forEach((uuid, v) -> out.add(new KpiMission(uuid, v[0], v[1], v[2])));
        return out;
    }

    private static LocalDate parseDay(String name, String value) {
        String v = value.trim();
        if (!DAY.matcher(v).matches()) {
            throw new KpiException(name + " must be a UTC date YYYY-MM-DD");
        }
        try {
            return LocalDate.parse(v);
        } catch (DateTimeParseException ex) {
            throw new KpiException(name + " must be a UTC date YYYY-MM-DD");
        }
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
