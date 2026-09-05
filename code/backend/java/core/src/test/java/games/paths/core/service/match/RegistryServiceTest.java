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
import static org.mockito.ArgumentMatchers.isNull;
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
        return new RegistryRow(1L, "u-" + key, key, s, i, null, null, null, null, 0);
    }

    private static RegistryRow multiRow(String key, String s, Integer i) {
        return new RegistryRow(1L, "u-" + key, key, s, i, null, null, null, null, 1);
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
            assertTrue(RegistryService.evaluate("=", "OPEN", List.of("OPEN")));
            assertFalse(RegistryService.evaluate("=", "OPEN", List.of("SHUT")));
            assertTrue(RegistryService.evaluate("!=", "OPEN", List.of("SHUT")));
            assertFalse(RegistryService.evaluate("!=", "OPEN", List.of("OPEN")));
        }

        @Test
        @DisplayName("> and < need both sides numeric")
        void ordering() {
            assertTrue(RegistryService.evaluate(">", "3", List.of("4")));
            assertFalse(RegistryService.evaluate(">", "3", List.of("3")));
            assertTrue(RegistryService.evaluate("<", "3", List.of("2")));
            assertFalse(RegistryService.evaluate(">", "3", List.of("many")));
            assertFalse(RegistryService.evaluate("<", "lots", List.of("2")));
        }

        @Test
        @DisplayName("an absent key satisfies only !=")
        void absentKey() {
            assertTrue(RegistryService.evaluate("!=", "OPEN", List.of()));
            assertFalse(RegistryService.evaluate("=", "OPEN", List.of()));
            assertFalse(RegistryService.evaluate(">", "1", List.of()));
        }

        @Test
        @DisplayName("a null expected value is never met — a typo must lock a door")
        void nullExpectedNeverMet() {
            assertFalse(RegistryService.evaluate("=", null, List.of("OPEN")));
            assertFalse(RegistryService.evaluate("!=", null, List.of("OPEN")));
            assertFalse(RegistryService.evaluate("=", null, List.of()));
        }

        @Test
        @DisplayName("a null or blank operator means =, an unknown one is never met")
        void operatorDefaulting() {
            assertTrue(RegistryService.evaluate(null, "OPEN", List.of("OPEN")));
            assertTrue(RegistryService.evaluate("   ", "OPEN", List.of("OPEN")));
            assertTrue(RegistryService.evaluate(" = ", "OPEN", List.of("OPEN")));
            assertFalse(RegistryService.evaluate("~=", "OPEN", List.of("OPEN")));
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
            Map<String, List<String>> map = service.loadAll(1L);
            assertEquals(3, map.size());
            assertEquals(List.of("yes"), map.get("flag"));
            assertEquals(List.of("7"), map.get("count"));
            assertTrue(map.containsKey("empty"));
            assertTrue(map.get("empty").isEmpty());
        }

        @Test
        @DisplayName("find renders one key; an absent key is empty")
        void find() {
            when(store.findByMatchAndKey(1L, "count")).thenReturn(List.of(row("count", null, 7)));
            when(store.findByMatchAndKey(1L, "gone")).thenReturn(List.of());
            assertEquals(List.of("7"), service.find(1L, "count"));
            assertTrue(service.find(1L, "gone").isEmpty());
        }

        @Test
        @DisplayName("listEntries keeps both columns apart for the /info payload")
        void listEntries() {
            when(store.findByMatch(1L)).thenReturn(List.of(row("flag", "yes", null)));
            List<MatchRegistryEntry> out = service.listEntries(1L, null, true, "en");
            assertEquals(1, out.size());
            assertEquals("flag", out.get(0).getKey());
            assertEquals(List.of("yes"), out.get(0).getValues());
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
            assertEquals(java.util.List.of("3"), e.getValues());
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
            service.upsert(1L, null, null, "v", null, null, null, 0);
            service.upsert(1L, null, "   ", "v", null, null, null, 0);
            verifyNoInteractions(store);
        }

        @Test
        @DisplayName("upsert splits the value and carries the whole provenance")
        void upsertCarriesProvenance() {
            service.upsert(1L, null, "count", " 42 ", 3L, 12L, 9L, 5);
            verify(store).upsert(1L, "count", null, 42, 3L, 12L, 9L, 5);
        }

        @Test
        @DisplayName("a null value clears both columns")
        void upsertNullClearsBoth() {
            service.upsert(1L, null, "flag", null, null, null, null, 2);
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

    @Nested
    @DisplayName("multi-valued keys (Step 36.1)")
    class MultiValued {

        private games.paths.core.port.story.StoryReadPort storyReadPort;
        private RegistryService declaring;

        @BeforeEach
        void wire() {
            storyReadPort = mock(games.paths.core.port.story.StoryReadPort.class);
            declaring = new RegistryService(store, storyReadPort, null);
        }

        private KeyEntity key(String name, String value, boolean multi) {
            KeyEntity k = new KeyEntity();
            k.setName(name);
            k.setValue(value);
            k.setMultiValue(multi ? 1 : 0);
            return k;
        }

        @Test
        @DisplayName("= and != quantify over the set: one member is enough, none is required")
        void existsAndNotExists() {
            List<String> set = List.of("A", "B");
            assertTrue(RegistryService.evaluate("=", "B", set));
            assertFalse(RegistryService.evaluate("=", "C", set));
            assertTrue(RegistryService.evaluate("!=", "C", set));
            assertFalse(RegistryService.evaluate("!=", "A", set));
            assertTrue(RegistryService.evaluate("!=", "A", null));
        }

        @Test
        @DisplayName("> and < ask EVERY member, and an empty set never answers yes")
        void forAllMembers() {
            assertTrue(RegistryService.evaluate(">", "3", List.of("5", "7")));
            assertFalse(RegistryService.evaluate(">", "3", List.of("2", "7")));
            assertTrue(RegistryService.evaluate("<", "3", List.of("1", "2")));
            assertFalse(RegistryService.evaluate("<", "3", List.of("1", "9")));
            assertFalse(RegistryService.evaluate(">", "3", List.of()));
            assertFalse(RegistryService.evaluate("<", "3", List.of()));
        }

        @Test
        @DisplayName("ordered puts the numbers first and numerically, then the rest by name")
        void orderedMembers() {
            assertEquals(List.of("2", "10", "alpha", "beta"),
                    RegistryService.ordered(List.of("beta", "10", "alpha", "2")));
            assertTrue(RegistryService.ordered(null).isEmpty());
        }

        @Test
        @DisplayName("a key the story declares MULTI joins instead of replacing")
        void firstWriteFollowsTheStory() {
            when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of(key("clues", null, true)));

            assertEquals(List.of("A"), declaring.upsert(1L, 9L, "clues", "A", 3L, 12L, null, 6));

            verify(store).insertValue(1L, "clues", "A", null, 3L, 12L, null, 6);
            verify(store, never()).upsert(anyLong(), any(), any(), any(), any(), any(), any(), any());
            verify(store).logChange(1L, 3L, 12L, null, 6,
                    RegistryService.MSG_REGISTRY_CHANGE + " clues +A");
        }

        @Test
        @DisplayName("the rows decide, not the story: a match keeps the behaviour it was born with")
        void rowsWinOverTheStory() {
            when(store.findByMatchAndKey(1L, "clues"))
                    .thenReturn(List.of(multiRow("clues", "A", null)));
            when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of(key("clues", null, false)));

            assertEquals(List.of("A", "B"),
                    declaring.upsert(1L, 9L, "clues", "B", null, null, null, 1));
            verify(store).insertValue(1L, "clues", "B", null, null, null, null, 1);
        }

        @Test
        @DisplayName("adding a member the set already holds writes nothing and logs nothing")
        void duplicateMemberIsANoOp() {
            when(store.findByMatchAndKey(1L, "clues"))
                    .thenReturn(List.of(multiRow("clues", "A", null)));

            assertEquals(List.of("A"), service.upsert(1L, null, "clues", "A", null, null, null, 1));
            assertEquals(List.of("A"), service.upsert(1L, null, "clues", null, null, null, null, 1));

            verify(store, never()).insertValue(anyLong(), any(), any(), any(), any(), any(), any(), any());
            verify(store, never()).logChange(anyLong(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("remove on a blank key, or on a key this match never wrote, does nothing")
        void removeNoOp() {
            assertTrue(service.remove(1L, "  ", "A", null, null, null, 1).isEmpty());
            assertTrue(service.remove(1L, "clues", "A", null, null, null, 1).isEmpty());
            verify(store, never()).deleteValue(anyLong(), any(), any(), any());
            verify(store, never()).upsert(anyLong(), any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("on a SINGLE key remove is still compare-and-clear")
        void removeClearsASingleKey() {
            when(store.findByMatchAndKey(1L, "door")).thenReturn(List.of(row("door", "OPEN", null)));

            assertTrue(service.remove(1L, "door", "OPEN", 3L, 12L, null, 6).isEmpty());

            verify(store).upsert(1L, "door", null, null, 3L, 12L, null, 6);
            verify(store).logChange(1L, 3L, 12L, null, 6,
                    RegistryService.MSG_REGISTRY_CHANGE + " door OPEN -> null");
        }

        @Test
        @DisplayName("a single key the story has since moved on from is left alone")
        void removeLeavesAMovedOnValue() {
            when(store.findByMatchAndKey(1L, "door")).thenReturn(List.of(row("door", "SHUT", null)));

            assertEquals(List.of("SHUT"), service.remove(1L, "door", "OPEN", null, null, null, 1));
            assertEquals(List.of("SHUT"), service.remove(1L, "door", null, null, null, null, 1));

            verify(store, never()).upsert(anyLong(), any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("on a MULTI key remove takes one member away and leaves the rest")
        void removeTakesOneMember() {
            when(store.findByMatchAndKey(1L, "clues")).thenReturn(List.of(
                    multiRow("clues", "A", null), multiRow("clues", "B", null)));

            assertEquals(List.of("A"), service.remove(1L, "clues", "B", 3L, null, 9L, 4));

            verify(store).deleteValue(1L, "clues", "B", null);
            verify(store).logChange(1L, 3L, null, 9L, 4,
                    RegistryService.MSG_REGISTRY_CHANGE + " clues -B");
        }

        @Test
        @DisplayName("removing a member the set never held changes nothing")
        void removeAbsentMember() {
            when(store.findByMatchAndKey(1L, "clues"))
                    .thenReturn(List.of(multiRow("clues", "A", null)));

            assertEquals(List.of("A"), service.remove(1L, "clues", "Z", null, null, null, 1));
            verify(store, never()).deleteValue(anyLong(), any(), any(), any());
        }

        @Test
        @DisplayName("seed stamps the mirror, and a MULTI key with no default seeds no row at all")
        void seedStampsTheMirror() {
            declaring.seed(9L, List.of(key("clues", null, true), key("found", "A", true),
                    key("door", "SHUT", false)));

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<RegistryRow>> cap = ArgumentCaptor.forClass(List.class);
            verify(store).insertAll(eq(9L), cap.capture());
            List<RegistryRow> rows = cap.getValue();

            assertEquals(2, rows.size());
            assertEquals("found", rows.get(0).key());
            assertTrue(rows.get(0).isMulti());
            assertEquals("door", rows.get(1).key());
            assertFalse(rows.get(1).isMulti());
        }

        @Test
        @DisplayName("loadAll and find give a multi key every one of its members")
        void readsCollectTheWholeSet() {
            List<RegistryRow> rows = List.of(
                    multiRow("clues", "A", null), multiRow("clues", null, 2));
            when(store.findByMatch(1L)).thenReturn(rows);
            when(store.findByMatchAndKey(1L, "clues")).thenReturn(rows);

            assertEquals(List.of("A", "2"), service.loadAll(1L).get("clues"));
            assertEquals(List.of("A", "2"), service.find(1L, "clues"));
        }

        @Test
        @DisplayName("listEntries gives one ordered entry per key, an emptied key included")
        void entriesAreOnePerKey() {
            when(store.findByMatch(1L)).thenReturn(List.of(
                    multiRow("clues", "B", null), multiRow("clues", "A", null)));
            when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of(
                    key("clues", null, true), key("gone", null, true)));

            Map<String, MatchRegistryEntry> byKey = new java.util.HashMap<>();
            for (MatchRegistryEntry e : declaring.listEntries(1L, 9L, true, "en")) {
                byKey.put(e.getKey(), e);
            }

            assertEquals(List.of("A", "B"), byKey.get("clues").getValues());
            assertTrue(byKey.get("clues").isMultiValue());
            assertTrue(byKey.get("gone").getValues().isEmpty());
        }

        @Test
        @DisplayName("replacing a SINGLE key logs the value it held before")
        void singleKeyLogsThePreviousValue() {
            when(store.findByMatchAndKey(1L, "door")).thenReturn(List.of(row("door", "SHUT", null)));

            assertEquals(List.of("OPEN"),
                    service.upsert(1L, null, "door", "OPEN", 3L, 12L, null, 6));

            verify(store).upsert(1L, "door", "OPEN", null, 3L, 12L, null, 6);
            verify(store).logChange(1L, 3L, 12L, null, 6,
                    RegistryService.MSG_REGISTRY_CHANGE + " door SHUT -> OPEN");
        }

        @Test
        @DisplayName("removing nothing from a set takes nothing away")
        void removeNullFromASet() {
            when(store.findByMatchAndKey(1L, "clues"))
                    .thenReturn(List.of(multiRow("clues", "A", null)));

            assertEquals(List.of("A"), service.remove(1L, "clues", null, null, null, null, 1));
            verify(store, never()).deleteValue(anyLong(), any(), any(), any());
        }

        @Test
        @DisplayName("a row holding no value at all is not a member of the set")
        void aValuelessRowIsNotAMember() {
            List<RegistryRow> rows = List.of(
                    multiRow("clues", "A", null), multiRow("clues", null, null));
            when(store.findByMatch(1L)).thenReturn(rows);
            when(store.findByMatchAndKey(1L, "clues")).thenReturn(rows);

            assertEquals(List.of("A"), service.find(1L, "clues"));
            assertEquals(List.of("A"),
                    service.listEntries(1L, null, true, "en").get(0).getValues());
            assertEquals(List.of("A"), service.remove(1L, "clues", "Z", null, null, null, 1));
        }
    }

    @Nested
    @DisplayName("v0.36.2 - a string comparison ignores case and padding")
    class CaseAndPadding {

        @Test
        @DisplayName("= and != fold case and trim both sides")
        void equalityIsBlindToCaseAndPadding() {
            assertTrue(RegistryService.evaluate("=", "ledger", List.of(" Ledger ")));
            assertTrue(RegistryService.evaluate("=", " LEDGER ", List.of("ledger")));
            assertFalse(RegistryService.evaluate("!=", "ledger", List.of(" Ledger ")));
            assertTrue(RegistryService.evaluate("!=", "letter", List.of(" Ledger ")));
        }

        @Test
        @DisplayName("a numeric comparison is unchanged: padding trims, both sides must parse")
        void numericComparisonStillNeedsNumbers() {
            assertTrue(RegistryService.evaluate(">", "3", List.of(" 4 ")));
            assertFalse(RegistryService.evaluate(">", "3", List.of("four")));
        }

        @Test
        @DisplayName("a set does not gain a second spelling of a member it already holds")
        void multiUpsertDeduplicatesAcrossSpellings() {
            when(store.findByMatchAndKey(1L, "clues")).thenReturn(List.of(multiRow("clues", " Ledger ", null)));

            assertEquals(List.of(" Ledger "),
                    service.upsert(1L, null, "clues", "LEDGER", null, null, null, 1));
            verify(store, never()).insertValue(anyLong(), any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("compare-and-clear empties a single key named in another case")
        void singleRemoveMatchesAcrossSpellings() {
            when(store.findByMatchAndKey(1L, "clue")).thenReturn(List.of(row("clue", " Ledger ", null)));

            assertEquals(List.of(), service.remove(1L, "clue", "ledger", null, null, null, 1));
            verify(store).upsert(1L, "clue", null, null, null, null, null, 1);
        }

        @Test
        @DisplayName("a set member is named case-blind but deleted exactly as it is stored")
        void multiRemoveDeletesTheStoredSpelling() {
            when(store.findByMatchAndKey(1L, "clues"))
                    .thenReturn(List.of(multiRow("clues", " Ledger ", null), multiRow("clues", "letter", null)));

            assertEquals(List.of("letter"),
                    service.remove(1L, "clues", "LEDGER", null, null, null, 1));
            verify(store).deleteValue(1L, "clues", " Ledger ", null);
        }
    }

    @Nested
    @DisplayName("admin edit by match uuid (v0.36.2)")
    class AdminEdit {

        @Test
        @DisplayName("an unknown match answers empty, never a guess")
        void findUnknownMatch() {
            when(store.findMatchAndStoryIdByUuid("nope")).thenReturn(Optional.empty());
            assertEquals(List.of(), service.findByMatchUuid("nope", "clue"));
        }

        @Test
        @DisplayName("the values of one key, addressed by match uuid")
        void findByUuid() {
            when(store.findMatchAndStoryIdByUuid("m-1")).thenReturn(Optional.of(new long[] {7L, 3L}));
            when(store.findByMatchAndKey(7L, "clue")).thenReturn(List.of(row("clue", "ledger", null)));

            assertEquals(List.of("ledger"), service.findByMatchUuid("m-1", "clue"));
        }

        @Test
        @DisplayName("upsert on an unknown match is null, not an empty list")
        void upsertUnknownMatch() {
            when(store.findMatchAndStoryIdByUuid("nope")).thenReturn(Optional.empty());
            assertNull(service.upsertByMatchUuid("nope", "clue", "ledger"));
        }

        @Test
        @DisplayName("the console writing a key goes through the ordinary upsert")
        void upsertByUuid() {
            when(store.findMatchAndStoryIdByUuid("m-1")).thenReturn(Optional.of(new long[] {7L, 3L}));
            when(store.findByMatchAndKey(7L, "clue")).thenReturn(List.of());

            assertEquals(List.of("ledger"), service.upsertByMatchUuid("m-1", "clue", "ledger"));
            verify(store).upsert(eq(7L), eq("clue"), eq("ledger"), isNull(), isNull(), isNull(), isNull(), isNull());
        }

        @Test
        @DisplayName("remove on an unknown match is null")
        void removeUnknownMatch() {
            when(store.findMatchAndStoryIdByUuid("nope")).thenReturn(Optional.empty());
            assertNull(service.removeByMatchUuid("nope", "clue", "ledger"));
        }

        @Test
        @DisplayName("a named value takes one member away and leaves the rest")
        void removeOneMember() {
            when(store.findMatchAndStoryIdByUuid("m-1")).thenReturn(Optional.of(new long[] {7L, 3L}));
            when(store.findByMatchAndKey(7L, "clues"))
                    .thenReturn(List.of(multiRow("clues", "ledger", null), multiRow("clues", "letter", null)));

            assertEquals(List.of("letter"), service.removeByMatchUuid("m-1", "clues", "ledger"));
        }

        @Test
        @DisplayName("no value empties the key whatever it holds")
        void removeWithoutAValueClearsTheKey() {
            when(store.findMatchAndStoryIdByUuid("m-1")).thenReturn(Optional.of(new long[] {7L, 3L}));
            when(store.findByMatchAndKey(7L, "clues"))
                    .thenReturn(List.of(multiRow("clues", "ledger", null), multiRow("clues", "letter", null)));

            assertEquals(List.of(), service.removeByMatchUuid("m-1", "clues", null));
            verify(store, times(2)).deleteValue(eq(7L), eq("clues"), any(), any());
        }

        @Test
        @DisplayName("a blank key is authored noise: nothing is cleared")
        void clearRejectsABlankKey() {
            when(store.findMatchAndStoryIdByUuid("m-1")).thenReturn(Optional.of(new long[] {7L, 3L}));

            assertEquals(List.of(), service.removeByMatchUuid("m-1", "  ", null));
            verify(store, never()).deleteValue(anyLong(), any(), any(), any());
        }

        @Test
        @DisplayName("a value that is not a number stays in the string column")
        void numericIgnoresANonNumber() {
            assertNull(RegistryService.parse("k", "winter").intValue());
            assertEquals("winter", RegistryService.parse("k", "winter").stringValue());
        }
    }
}
