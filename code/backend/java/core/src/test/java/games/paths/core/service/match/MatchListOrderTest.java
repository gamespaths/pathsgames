package games.paths.core.service.match;

import games.paths.core.model.match.MatchSummary;
import games.paths.core.model.match.MatchSummaryPage;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Unit tests of {@link MatchListOrder}: v1.7.0 step 9 order and in-memory paging of the player's list. */
class MatchListOrderTest {

    private static MatchSummary s(String uuid, String status, String tsUpdate, String tsInsert) {
        MatchSummary m = new MatchSummary();
        m.setUuid(uuid);
        m.setStatus(status);
        m.setTsUpdate(tsUpdate);
        m.setTsInsert(tsInsert);
        return m;
    }

    private static List<String> uuids(List<MatchSummary> list) {
        return list.stream().map(MatchSummary::getUuid).toList();
    }

    @Test
    void activeFirstThenLastPlayed() {
        List<MatchSummary> sorted = MatchListOrder.sort(List.of(
                s("cancelled", "CANCELLED", "2026-10-22T12:00:00Z", null),
                s("running-old", "RUNNING", "2026-10-01T00:00:00Z", null),
                s("ended", "ENDED", "2026-10-21T00:00:00Z", null),
                s("paused", "PAUSED", "2026-10-10T00:00:00Z", null),
                s("created", "CREATED", "2026-10-05 00:00:00", null)));
        assertEquals(List.of("paused", "created", "running-old", "cancelled", "ended"), uuids(sorted));
    }

    @Test
    void missingTsUpdateFallsBackOnTsInsertThenUuid() {
        List<MatchSummary> sorted = MatchListOrder.sort(List.of(
                s("b", "RUNNING", null, "2026-10-01T00:00:00Z"),
                s("a", "RUNNING", "garbage", "2026-10-02T00:00:00Z"),
                s(null, "RUNNING", null, null),
                s("c", "RUNNING", null, null)));
        assertEquals("a", sorted.get(0).getUuid());
        assertEquals("b", sorted.get(1).getUuid());
        assertNull(sorted.get(2).getUuid());
        assertEquals("c", sorted.get(3).getUuid());
        assertTrue(MatchListOrder.sort(null).isEmpty());
    }

    @Test
    void nextCursorIsNullUpToFiftyMatches() {
        List<MatchSummary> fifty = new ArrayList<>();
        for (int i = 0; i < 50; i++) {
            fifty.add(s("m" + i, "ENDED", "2026-10-01T00:00:" + String.format("%02d", i) + "Z", null));
        }
        MatchSummaryPage page = MatchListOrder.page(fifty, null, null);
        assertEquals(50, page.items().size());
        assertNull(page.nextCursor());
        assertEquals(50, page.limit());
    }

    @Test
    void beyondFiftyTheCursorIsAPosition() {
        List<MatchSummary> many = new ArrayList<>();
        for (int i = 0; i < 51; i++) {
            many.add(s(String.format("m%02d", i), "ENDED", "2026-10-01T00:00:00Z", null));
        }
        MatchSummaryPage first = MatchListOrder.page(many, null, "");
        assertEquals("50", first.nextCursor());
        MatchSummaryPage second = MatchListOrder.page(many, null, first.nextCursor());
        assertEquals(1, second.items().size());
        assertNull(second.nextCursor());
        assertTrue(MatchListOrder.page(many, 10, "999").items().isEmpty());
    }

    @Test
    void limitAndCursorAreClamped() {
        assertEquals(50, MatchListOrder.clampLimit(null));
        assertEquals(1, MatchListOrder.clampLimit(0));
        assertEquals(200, MatchListOrder.clampLimit(500));
        assertEquals(0, MatchListOrder.offsetOf(null));
        assertEquals(0, MatchListOrder.offsetOf("abc"));
        assertEquals(0, MatchListOrder.offsetOf("-4"));
        assertEquals(7, MatchListOrder.offsetOf(" 7 "));
    }
}
