package games.paths.core.service.match;

import games.paths.core.port.match.KpiPort;
import games.paths.core.port.match.KpiPort.KpiException;
import games.paths.core.port.match.KpiPort.KpiReport;
import games.paths.core.port.match.KpiPort.Metric;
import games.paths.core.port.match.KpiStorePort;
import games.paths.core.port.match.KpiStorePort.KpiDailyRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** KpiService (v0.41.2): best-effort record, day/month/total grouping, null rates, validation. */
@DisplayName("KpiService (v0.41.2)")
class KpiServiceTest {

    private static final Clock NOW = Clock.fixed(Instant.parse("2026-09-29T23:30:00Z"), ZoneOffset.UTC);
    private KpiStorePort store;
    private KpiService service;

    @BeforeEach
    void setUp() {
        store = mock(KpiStorePort.class);
        service = new KpiService(store, NOW);
    }

    private static KpiDailyRow row(String day, Metric metric, String ref, long value) {
        return new KpiDailyRow("s-1", day, metric.name(), ref, value);
    }

    @Test
    @DisplayName("record writes today's UTC day with an empty ref by default")
    void recordsToday() {
        service.record("s-1", Metric.MATCH_STARTED, null, 1);
        service.record("s-1", Metric.CHOICE, "c-1", 2);
        verify(store).increment("s-1", "2026-09-29", "MATCH_STARTED", "", 1);
        verify(store).increment("s-1", "2026-09-29", "CHOICE", "c-1", 2);
    }

    @Test
    @DisplayName("record ignores a blank story, a null metric and a zero delta")
    void recordSkips() {
        service.record(null, Metric.COMA, null, 1);
        service.record(" ", Metric.COMA, null, 1);
        service.record("s-1", null, null, 1);
        service.record("s-1", Metric.COMA, null, 0);
        verifyNoInteractions(store);
    }

    @Test
    @DisplayName("a store failure is swallowed: the action never fails because of a KPI")
    void recordIsBestEffort() {
        doThrow(new IllegalStateException("db down")).when(store)
                .increment(anyString(), anyString(), anyString(), anyString(), anyLong());
        assertDoesNotThrow(() -> service.record("s-1", Metric.COMA, null, 1));

        when(store.findStoryUuidByMatch(7L)).thenThrow(new IllegalStateException("db down"));
        assertDoesNotThrow(() -> service.recordForMatch(7L, Metric.COMA, null, 1));

        when(store.findLocationUuid(9L, 3L)).thenThrow(new IllegalStateException("db down"));
        assertDoesNotThrow(() -> service.recordLocationVisit(7L, 9L, 3L));
    }

    @Test
    @DisplayName("recordForMatch and recordLocationVisit resolve the uuids first")
    void recordsThroughTheMatch() {
        when(store.findStoryUuidByMatch(7L)).thenReturn(Optional.of("s-1"));
        when(store.findStoryUuidByMatch(8L)).thenReturn(Optional.empty());
        when(store.findLocationUuid(9L, 3L)).thenReturn(Optional.of("loc-3"));
        when(store.findLocationUuid(9L, 4L)).thenReturn(Optional.empty());

        service.recordForMatch(7L, Metric.COMA, null, 1);
        service.recordForMatch(8L, Metric.COMA, null, 1);
        service.recordLocationVisit(7L, 9L, 3L);
        service.recordLocationVisit(7L, 9L, 4L);

        verify(store).increment("s-1", "2026-09-29", "COMA", "", 1);
        verify(store).increment("s-1", "2026-09-29", "LOCATION_VISIT", "loc-3", 1);
        verify(store, times(2)).increment(anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    @DisplayName("default range: the last 30 days by day, zero rows included, nulls when nothing happened")
    void defaultRange() {
        when(store.findRows(null, "2026-08-31", "2026-09-29")).thenReturn(List.of());

        KpiReport r = service.report(null, null, null, null);

        assertNull(r.storyUuid());
        assertEquals("2026-08-31", r.from());
        assertEquals("2026-09-29", r.to());
        assertEquals("day", r.groupBy());
        assertEquals(30, r.rows().size());
        assertEquals("2026-08-31", r.rows().get(0).period());
        assertNull(r.rows().get(0).completionRate());
        assertNull(r.rows().get(0).avgDurationMinutes());
        assertNull(r.rows().get(0).avgDurationClocks());
        assertTrue(r.choices().isEmpty());
    }

    @Test
    @DisplayName("day rows carry the rate and the averages; the uuid tables cover the whole range")
    void dayReport() {
        when(store.findRows("s-1", "2026-09-28", "2026-09-29")).thenReturn(List.of(
                row("2026-09-28", Metric.MATCH_STARTED, "", 3),
                row("2026-09-28", Metric.MATCH_COMPLETED, "", 2),
                row("2026-09-28", Metric.DURATION_MS, "", 185_000),
                row("2026-09-28", Metric.DURATION_CLOCKS, "", 5),
                row("2026-09-28", Metric.COMA, "", 1),
                row("2026-09-28", Metric.CHOICE, "c-1", 1),
                row("2026-09-29", Metric.CHOICE, "c-1", 2),
                row("2026-09-29", Metric.CHOICE, "c-2", 3),
                row("2026-09-29", Metric.LOCATION_VISIT, "l-1", 1),
                row("2026-09-29", Metric.MISSION_ACTIVE, "m-2", 1),
                row("2026-09-29", Metric.MISSION_COMPLETED, "m-1", 1),
                row("2026-09-29", Metric.MISSION_FAILED, "m-1", 2),
                new KpiDailyRow("s-1", "2026-09-29", "UNKNOWN_METRIC", "", 9),
                new KpiDailyRow("s-1", null, "COMA", "", 9),
                new KpiDailyRow("s-1", "2026-09-29", null, null, 9)));

        KpiReport r = service.report(" s-1 ", "2026-09-28", "2026-09-29", "DAY");

        assertEquals("s-1", r.storyUuid());
        KpiPort.KpiRow first = r.rows().get(0);
        assertEquals(3, first.matchesStarted());
        assertEquals(2, first.matchesCompleted());
        assertEquals(0.6667, first.completionRate());
        assertEquals(1.54, first.avgDurationMinutes());
        assertEquals(2.5, first.avgDurationClocks());
        assertEquals(1, first.comaCount());
        assertEquals(0, r.rows().get(1).comaCount());
        assertEquals(List.of(new KpiPort.KpiCount("c-1", 3), new KpiPort.KpiCount("c-2", 3)), r.choices());
        assertEquals(List.of(new KpiPort.KpiCount("l-1", 1)), r.locations());
        assertEquals(List.of(new KpiPort.KpiMission("m-1", 0, 1, 2), new KpiPort.KpiMission("m-2", 1, 0, 0)),
                r.missions());
    }

    @Test
    @DisplayName("month and total fold the days together")
    void monthAndTotal() {
        List<KpiDailyRow> rows = List.of(row("2026-08-31", Metric.MATCH_STARTED, "", 1),
                row("2026-09-01", Metric.MATCH_STARTED, "", 2), row("2026-09-01", Metric.MATCH_COMPLETED, "", 1));
        when(store.findRows(any(), any(), any())).thenReturn(rows);

        KpiReport month = service.report("s-1", "2026-08-30", "2026-09-02", "month");
        assertEquals(List.of("2026-08", "2026-09"), month.rows().stream().map(KpiPort.KpiRow::period).toList());
        assertEquals(1, month.rows().get(0).matchesStarted());
        assertEquals(2, month.rows().get(1).matchesStarted());

        KpiReport total = service.report("s-1", "2026-08-30", "2026-09-02", "total");
        assertEquals(1, total.rows().size());
        assertEquals("total", total.rows().get(0).period());
        assertEquals(3, total.rows().get(0).matchesStarted());
        assertEquals(0.3333, total.rows().get(0).completionRate());
    }

    @Test
    @DisplayName("only one bound given: the other defaults around it")
    void oneBound() {
        when(store.findRows(any(), any(), any())).thenReturn(List.of());
        assertEquals("2026-09-01", service.report("", null, "2026-09-30", "day").from());
        assertEquals("2026-09-29", service.report(null, "2026-09-20", " ", "total").to());
    }

    @Test
    @DisplayName("bad groupBy, bad dates, from after to and more than 366 days are INVALID_INPUT")
    void invalidInput() {
        assertInvalid(() -> service.report(null, null, null, "week"));
        assertInvalid(() -> service.report(null, "2026/09/01", null, null));
        assertInvalid(() -> service.report(null, "2026-02-30", null, null));
        assertInvalid(() -> service.report(null, null, "yesterday", null));
        assertInvalid(() -> service.report(null, "2026-09-10", "2026-09-01", null));
        assertInvalid(() -> service.report(null, "2025-09-28", "2026-09-29", null));
        assertDoesNotThrow(() -> service.report(null, "2025-09-29", "2026-09-29", null));
    }

    private static void assertInvalid(org.junit.jupiter.api.function.Executable call) {
        KpiException ex = assertThrows(KpiException.class, call);
        assertEquals("INVALID_INPUT", ex.getCode());
    }

    @Test
    @DisplayName("the one-argument constructor runs on the system UTC clock")
    void systemClock() {
        assertDoesNotThrow(() -> new KpiService(store).record("s-1", Metric.COMA, null, 1));
        verify(store).increment(eq("s-1"), anyString(), eq("COMA"), eq(""), eq(1L));
    }

    private static <T> T eq(T value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }
}
