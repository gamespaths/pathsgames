package games.paths.core.model.match.export;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** v0.41.4 — log_events message → timeline type, the timeline message and the stored message back. */
@DisplayName("LogTypeMapper (v0.41.4)")
class LogTypeMapperTest {

    @Test
    void classifiesEveryMessage() {
        assertNull(LogTypeMapper.eventType(null));
        assertEquals("SLEEP", LogTypeMapper.eventType("ACTION_SLEEP"));
        assertEquals("EVENT", LogTypeMapper.eventType("EVENT_EXECUTED 13"));
        assertEquals("CHOICE", LogTypeMapper.eventType("CHOICE_SELECTED 13"));
        assertEquals("COUNTER_ZERO", LogTypeMapper.eventType("counter zero at 3"));
        assertEquals("AUTOMATIC_EVENT", LogTypeMapper.eventType("automatic event 4"));
        assertEquals("RANDOM_EVENT", LogTypeMapper.eventType("random event 5"));
        assertEquals("REGISTRY_CHANGE", LogTypeMapper.eventType("REGISTRY_CHANGE k=v"));
        assertEquals("MISSION_CHANGE", LogTypeMapper.eventType("MISSION_CHANGE u ACTIVE"));
        assertEquals("EXP_USE", LogTypeMapper.eventType("EXP_USE dex"));
        assertEquals("RECOVERY", LogTypeMapper.eventType("recovery safe=true"));
        assertEquals("PASS", LogTypeMapper.eventType("ACTION_PASS"));
        assertEquals("EDGE_STATE", LogTypeMapper.eventType("COMA character 1"));
        assertEquals("TRAIT_CHANGE", LogTypeMapper.eventType("TRAIT_ADD t-1"));
        assertEquals("TRAIT_CHANGE", LogTypeMapper.eventType("TRAIT_REMOVE t-1"));
        assertEquals("MATCH_LIFECYCLE", LogTypeMapper.eventType("MATCH_STARTED"));
        assertEquals("ADMIN_ACTION", LogTypeMapper.eventType("ADMIN_PAUSE"));
        assertEquals("OTHER", LogTypeMapper.eventType("something else"));
    }

    @Test
    void timelineMessageStripsTheStoragePrefix() {
        assertNull(LogTypeMapper.timelineMessage("EVENT", null));
        assertNull(LogTypeMapper.timelineMessage(null, "x"));
        assertNull(LogTypeMapper.timelineMessage("SLEEP", "ACTION_SLEEP"));
        assertNull(LogTypeMapper.timelineMessage("PASS", "ACTION_PASS"));
        assertEquals("COMA", LogTypeMapper.timelineMessage("EDGE_STATE", "COMA character 1"));
        assertEquals("ADD t-1", LogTypeMapper.timelineMessage("TRAIT_CHANGE", "TRAIT_ADD t-1"));
        assertEquals("STARTED", LogTypeMapper.timelineMessage("MATCH_LIFECYCLE", "MATCH_STARTED"));
        assertEquals("PAUSE", LogTypeMapper.timelineMessage("ADMIN_ACTION", "ADMIN_PAUSE"));
        assertEquals("EVENT_EXECUTED 13", LogTypeMapper.timelineMessage("EVENT", "EVENT_EXECUTED 13"));
    }

    @Test
    void storedMessageAddsThePrefixBack() {
        assertEquals("ACTION_SLEEP", LogTypeMapper.storedMessage("SLEEP", null));
        assertEquals("EVENT_EXECUTED 13", LogTypeMapper.storedMessage("EVENT", "EVENT_EXECUTED 13"));
        assertEquals("EVENT_EXECUTED 13", LogTypeMapper.storedMessage("EVENT", "13"));
        assertEquals("TRAIT_ADD t-1", LogTypeMapper.storedMessage("TRAIT_CHANGE", "ADD t-1"));
        assertEquals("MATCH_CREATED", LogTypeMapper.storedMessage("MATCH_LIFECYCLE", "CREATED"));
        assertEquals("ADMIN_IMPORTED x clock=2", LogTypeMapper.storedMessage("ADMIN_ACTION", "IMPORTED x clock=2"));
        assertEquals("COMA", LogTypeMapper.storedMessage("EDGE_STATE", "COMA"));
        assertEquals("IMPORTED_UNCOUNTED", LogTypeMapper.storedMessage("EDGE_STATE", " "));
        assertEquals("free text", LogTypeMapper.storedMessage("OTHER", "free text"));
        assertEquals("IMPORTED_UNCOUNTED", LogTypeMapper.storedMessage("OTHER", null));
        assertEquals("IMPORTED_UNCOUNTED EVENT_EXECUTED 1", LogTypeMapper.storedMessage("OTHER", "EVENT_EXECUTED 1"));
        assertTrue(LogTypeMapper.isEventRow("OTHER"));
        assertTrue(LogTypeMapper.isEventRow("PASS"));
        assertFalse(LogTypeMapper.isEventRow("MOVEMENT"));
    }

    @Test
    void itemActions() {
        assertEquals("ITEM_USE", LogTypeMapper.itemType(null));
        assertEquals("ITEM_ADD", LogTypeMapper.itemType(" add "));
        assertEquals("ITEM_USE", LogTypeMapper.itemType("USE"));
        assertEquals("ITEM_DROP", LogTypeMapper.itemType("DROP"));
        assertEquals("ITEM_DROP", LogTypeMapper.itemType("REMOVE"));
        assertNull(LogTypeMapper.itemType("TRADE"));
    }
}
