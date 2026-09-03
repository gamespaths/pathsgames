package games.paths.core.service.match;

import games.paths.core.entity.story.KeyEntity;
import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.port.match.RegistryStorePort;
import games.paths.core.port.match.RegistryStorePort.RegistryRow;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@DisplayName("RegistryService (Step 36)")
class RegistryServiceTest {

    private RegistryStorePort store;
    private RegistryService service;

    @BeforeEach
    void setUp() {
        store = mock(RegistryStorePort.class);
        service = new RegistryService(store);
    }

    private static RegistryRow row(String key, String s, Integer i) {
        return new RegistryRow(1L, "u-" + key, key, s, i, null, null, null, null);
    }

    @Nested
    @DisplayName("render and parse are exact inverses")
    class Codec {

        @Test
        @DisplayName("the string wins, else the int, else null")
        void renderPrefersString() {
            assertEquals("WINTER", RegistryService.render("WINTER", null));
            assertEquals("5", RegistryService.render(null, 5));
            assertNull(RegistryService.render(null, null));
            assertNull(RegistryService.render((RegistryRow) null));
        }

        @Test
        @DisplayName("a numeric value lands in int_value, anything else in string_value")
        void parseSplitsTheColumns() {
            assertEquals(42, RegistryService.parse("k", "42").intValue());
            assertNull(RegistryService.parse("k", "42").stringValue());
            assertEquals("hi", RegistryService.parse("k", "hi").stringValue());
            assertNull(RegistryService.parse("k", "hi").intValue());
        }

        @Test
        @DisplayName("trimmed in BOTH branches — the seeding behaviour, not the effect one")
        void parseTrimsEitherWay() {
            assertEquals(42, RegistryService.parse("k", "  42  ").intValue());
            assertEquals("hi", RegistryService.parse("k", "  hi  ").stringValue());
        }

        @Test
        @DisplayName("blank becomes an empty string; null leaves both columns null")
        void parseEdges() {
            assertEquals("", RegistryService.parse("k", "   ").stringValue());
            assertNull(RegistryService.parse("k", null).stringValue());
            assertNull(RegistryService.parse("k", null).intValue());
        }

        @Test
        @DisplayName("a parsed value renders back to what was written")
        void roundTrip() {
            for (String v : new String[]{"42", "hi", "", "0", "-7"}) {
                RegistryRow r = RegistryService.parse("k", v);
                assertEquals(v, RegistryService.render(r.stringValue(), r.intValue()));
            }
        }
    }

    @Nested
    @DisplayName("evaluate — the one comparison")
    class Evaluate {

        @Test
        @DisplayName("= and != are textual")
        void equality() {
            assertTrue(RegistryService.evaluate("=", "OPEN", "OPEN"));
            assertFalse(RegistryService.evaluate("=", "OPEN", "SHUT"));
            assertTrue(RegistryService.evaluate("!=", "OPEN", "SHUT"));
            assertFalse(RegistryService.evaluate("!=", "OPEN", "OPEN"));
        }

        @Test
        @DisplayName("> and < need both sides numeric")
        void ordering() {
            assertTrue(RegistryService.evaluate(">", "3", "4"));
            assertFalse(RegistryService.evaluate(">", "3", "3"));
            assertTrue(RegistryService.evaluate("<", "3", "2"));
            assertFalse(RegistryService.evaluate(">", "3", "many"));
            assertFalse(RegistryService.evaluate("<", "lots", "2"));
        }

        @Test
        @DisplayName("an absent key satisfies only !=")
        void absentKey() {
            assertTrue(RegistryService.evaluate("!=", "OPEN", null));
            assertFalse(RegistryService.evaluate("=", "OPEN", null));
            assertFalse(RegistryService.evaluate(">", "1", null));
        }

        @Test
        @DisplayName("a null expected value is never met — a typo must lock a door")
        void nullExpectedNeverMet() {
            assertFalse(RegistryService.evaluate("=", null, "OPEN"));
            assertFalse(RegistryService.evaluate("!=", null, "OPEN"));
            assertFalse(RegistryService.evaluate("=", null, null));
        }

        @Test
        @DisplayName("a null or blank operator means =, an unknown one is never met")
        void operatorDefaulting() {
            assertTrue(RegistryService.evaluate(null, "OPEN", "OPEN"));
            assertTrue(RegistryService.evaluate("   ", "OPEN", "OPEN"));
            assertTrue(RegistryService.evaluate(" = ", "OPEN", "OPEN"));
            assertFalse(RegistryService.evaluate("~=", "OPEN", "OPEN"));
        }

        @Test
        @DisplayName("a blank key is no condition at all")
        void noCondition() {
            assertTrue(RegistryService.noCondition(null));
            assertTrue(RegistryService.noCondition("   "));
            assertFalse(RegistryService.noCondition("GATE"));
        }
    }

    @Nested
    @DisplayName("reads")
    class Reads {

        @Test
        @DisplayName("loadAll renders every row and skips a row with no key")
        void loadAll() {
            when(store.findByMatch(1L)).thenReturn(List.of(
                    row("flag", "yes", null), row("count", null, 7),
                    row("empty", null, null), row(null, "orphan", null)));
            Map<String, String> map = service.loadAll(1L);
            assertEquals(3, map.size());
            assertEquals("yes", map.get("flag"));
            assertEquals("7", map.get("count"));
            assertTrue(map.containsKey("empty"));
            assertNull(map.get("empty"));
        }

        @Test
        @DisplayName("find renders one key; an absent key is empty")
        void find() {
            when(store.findByMatchAndKey(1L, "count")).thenReturn(Optional.of(row("count", null, 7)));
            when(store.findByMatchAndKey(1L, "gone")).thenReturn(Optional.empty());
            assertEquals(Optional.of("7"), service.find(1L, "count"));
            assertTrue(service.find(1L, "gone").isEmpty());
        }

        @Test
        @DisplayName("listEntries keeps both columns apart for the /info payload")
        void listEntries() {
            when(store.findByMatch(1L)).thenReturn(List.of(row("flag", "yes", null)));
            List<MatchRegistryEntry> out = service.listEntries(1L);
            assertEquals(1, out.size());
            assertEquals("flag", out.get(0).getKey());
            assertEquals("yes", out.get(0).getStringValue());
            assertNull(out.get(0).getIntValue());
            assertEquals("u-flag", out.get(0).getUuid());
        }
    }

    @Nested
    @DisplayName("joined with the story definitions")
    class Enriched {

        private games.paths.core.port.story.StoryReadPort storyReadPort;
        private games.paths.core.port.story.ContentQueryPort contentQueryPort;
        private RegistryService enriched;

        @org.junit.jupiter.api.BeforeEach
        void wire() {
            storyReadPort = mock(games.paths.core.port.story.StoryReadPort.class);
            contentQueryPort = mock(games.paths.core.port.story.ContentQueryPort.class);
            enriched = new RegistryService(store, storyReadPort, contentQueryPort);
        }

        private KeyEntity def(String name, String group, Integer priority, String visibility) {
            KeyEntity k = new KeyEntity();
            k.setName(name);
            k.setGroup(group);
            k.setPriority(priority);
            k.setVisibility(visibility);
            return k;
        }

        @Test
        @DisplayName("carries category, priority and visibility from list_keys")
        void carriesTheDefinition() {
            when(store.findByMatch(1L)).thenReturn(List.of(row("progress", null, 3)));
            when(storyReadPort.findKeysByStoryId(9L))
                    .thenReturn(List.of(def("progress", "tutorial", 2, "PUBLIC")));

            MatchRegistryEntry e = enriched.listEntries(1L, 9L, false, "en").get(0);

            assertEquals("tutorial", e.getCategory());
            assertEquals(2, e.getPriority());
            assertTrue(e.isVisible());
            assertEquals(3, e.getIntValue());
        }

        @Test
        @DisplayName("anything but PUBLIC is hidden, and hidden keys are dropped by default")
        void hiddenKeysAreDropped() {
            when(store.findByMatch(1L)).thenReturn(List.of(
                    row("shown", "a", null), row("secret", "b", null)));
            when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of(
                    def("shown", "g", 1, "PUBLIC"), def("secret", "g", 2, "PRIVATE")));

            assertEquals(List.of("shown"),
                    enriched.listEntries(1L, 9L, false, "en").stream().map(MatchRegistryEntry::getKey).toList());
            assertEquals(2, enriched.listEntries(1L, 9L, true, "en").size());
        }

        @Test
        @DisplayName("a key the story no longer declares is kept, but reads as hidden")
        void undeclaredKeyIsKeptButHidden() {
            when(store.findByMatch(1L)).thenReturn(List.of(row("orphan", "x", null)));
            when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of());

            assertTrue(enriched.listEntries(1L, 9L, false, "en").isEmpty());
            List<MatchRegistryEntry> all = enriched.listEntries(1L, 9L, true, "en");
            assertEquals(1, all.size());
            assertFalse(all.get(0).isVisible());
        }

        @Test
        @DisplayName("ordered by category, then priority, then key")
        void ordering() {
            when(store.findByMatch(1L)).thenReturn(List.of(
                    row("zeta", "v", null), row("alpha", "v", null), row("beta", "v", null)));
            when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of(
                    def("zeta", "tutorial", 2, "PUBLIC"),
                    def("alpha", "tutorial", 1, "PUBLIC"),
                    def("beta", "evidence", 1, "PUBLIC")));

            assertEquals(List.of("beta", "alpha", "zeta"),
                    enriched.listEntries(1L, 9L, false, "en").stream()
                            .map(MatchRegistryEntry::getKey).toList());
        }

        @Test
        @DisplayName("groups bucket the same entries, a key with no group under the null category")
        void groups() {
            when(store.findByMatch(1L)).thenReturn(List.of(row("a", "v", null), row("b", "v", null)));
            when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of(
                    def("a", "tutorial", 1, "PUBLIC"), def("b", null, 1, "PUBLIC")));

            var groups = enriched.listGroups(1L, 9L, false, "en");
            assertEquals(2, groups.size());
            assertNull(groups.get(0).category());
            assertEquals("tutorial", groups.get(1).category());
        }

        @Test
        @DisplayName("the card is resolved only when the key declares one")
        void cardResolution() {
            when(store.findByMatch(1L)).thenReturn(List.of(row("a", "v", null), row("b", "v", null)));
            KeyEntity withCard = def("a", "g", 1, "PUBLIC");
            withCard.setIdCard(950);
            when(storyReadPort.findKeysByStoryId(9L))
                    .thenReturn(List.of(withCard, def("b", "g", 2, "PUBLIC")));

            enriched.listEntries(1L, 9L, false, "en");

            verify(contentQueryPort).getCardByStoryIdAndCardId(9L, 950, "en");
            verify(contentQueryPort, never()).getCardByStoryIdAndCardId(eq(9L), eq(null), any());
        }

        @Test
        @DisplayName("with no story to join against, entries still come back — just bare")
        void noStory() {
            when(store.findByMatch(1L)).thenReturn(List.of(row("a", "v", null)));
            assertEquals(1, enriched.listEntries(1L, null, true, "en").size());
            verifyNoInteractions(storyReadPort);
        }
    }

    @Nested
    @DisplayName("writes")
    class Writes {

        @Test
        @DisplayName("a blank key is authored noise and is skipped, not an error")
        void blankKeySkipped() {
            service.upsert(1L, null, "v", null, null, null, 0);
            service.upsert(1L, "   ", "v", null, null, null, 0);
            verifyNoInteractions(store);
        }

        @Test
        @DisplayName("upsert splits the value and carries the whole provenance")
        void upsertCarriesProvenance() {
            service.upsert(1L, "count", " 42 ", 3L, 12L, 9L, 5);
            verify(store).upsert(1L, "count", null, 42, 3L, 12L, 9L, 5);
        }

        @Test
        @DisplayName("a null value clears both columns")
        void upsertNullClearsBoth() {
            service.upsert(1L, "flag", null, null, null, null, 2);
            verify(store).upsert(1L, "flag", null, null, null, null, null, 2);
        }

        @Test
        @DisplayName("seed writes one row per story key, holding its default")
        void seed() {
            service.seed(9L, List.of(key("n", "42"), key("name", "hi"), key("blank", "  "),
                    key("none", null)));
            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<RegistryRow>> cap = ArgumentCaptor.forClass(List.class);
            verify(store).insertAll(eq(9L), cap.capture());
            List<RegistryRow> rows = cap.getValue();
            assertEquals(4, rows.size());
            assertEquals(42, rows.get(0).intValue());
            assertEquals("hi", rows.get(1).stringValue());
            assertEquals("", rows.get(2).stringValue());
            assertNull(rows.get(3).stringValue());
            assertNull(rows.get(3).intValue());
        }

        @Test
        @DisplayName("a story with no keys still seeds an empty list")
        void seedNullKeys() {
            service.seed(9L, null);
            verify(store).insertAll(eq(9L), argThatEmpty());
        }

        @Test
        @DisplayName("deleteByMatch hands the ids straight to the store")
        void delete() {
            service.deleteByMatch(List.of(1L, 2L));
            verify(store).deleteByMatchIdIn(List.of(1L, 2L));
        }

        private List<RegistryRow> argThatEmpty() {
            return org.mockito.ArgumentMatchers.argThat(List::isEmpty);
        }

        private KeyEntity key(String name, String value) {
            KeyEntity k = new KeyEntity();
            k.setName(name);
            k.setValue(value);
            return k;
        }
    }
}
