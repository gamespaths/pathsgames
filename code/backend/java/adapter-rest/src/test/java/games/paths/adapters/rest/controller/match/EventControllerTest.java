package games.paths.adapters.rest.controller.match;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.EventExecutionPort.AppliedEffect;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException.Code;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionPort.ItemChange;
import games.paths.core.port.match.EventExecutionPort.RegistryChange;
import games.paths.core.port.match.EventExecutionPort.StatChange;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** EventController (Step 29) — POST /api/gameplay/{uuid}/action/execute-event. */
class EventControllerTest {

    private static final String URL = "/api/gameplay/m1/action/execute-event";
    private static final String BODY = "{\"eventUuid\":\"evt-1\"}";

    private MockMvc mockMvc;
    private EventExecutionPort eventExecutionPort;

    @BeforeEach
    void setUp() {
        eventExecutionPort = mock(EventExecutionPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new EventController(eventExecutionPort)).build();
    }

    private static MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    private static CardInfo card(String title) {
        return new CardInfo("c1", "event", null, null, "fa-bolt",
                null, null, null, null, null, title, "desc", null, null, null);
    }

    private static EventExecutionResult result() {
        return new EventExecutionResult(
                "m1", "evt-1", "ONCE", "APPLIED", card("The Stranger"),
                List.of("evt-1", "evt-2"),
                3, 2, 17, 8, 5,
                false, true, true, false, true, true, true, false, true, true,
                List.of(new StatChange("char-1", "life", 30, 25, -5)),
                List.of(new RegistryChange("GATE", null, "OPEN")),
                List.of(),
                List.of(new ItemChange("char-1", "item-1", "ADD")),
                List.of(),
                List.of(new EventExecutionPort.LocationChange("char-1", "loc-a", "loc-b")),
                List.of(new AppliedEffect("evt-1", "eff-1", "life", -5, "ONLY_ONE", null,
                        List.of("char-1"), card("A wound"))),
                List.of(),
                new EventExecutionPort.EdgeStateOutcome(
                        List.of("char-1"), List.of("char-1"), true,
                        "evt-coma", card("Everyone is down"),
                        List.of("evt-coma"), List.of()));
    }

    @Test
    void executeEvent_returns200WithTheFullPayload() throws Exception {
        when(eventExecutionPort.executeEvent("m1", "user-uuid", "evt-1", null)).thenReturn(result());

        mockMvc.perform(authed(post(URL)).contentType(APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventUuid").value("evt-1"))
                .andExpect(jsonPath("$.eventType").value("ONCE"))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.card.title").value("The Stranger"))
                .andExpect(jsonPath("$.executedEventUuids[1]").value("evt-2"))
                .andExpect(jsonPath("$.energySpent").value(3))
                .andExpect(jsonPath("$.coinSpent").value(2))
                .andExpect(jsonPath("$.newEnergy").value(17))
                .andExpect(jsonPath("$.newCoin").value(8))
                .andExpect(jsonPath("$.currentClock").value(5))
                .andExpect(jsonPath("$.turnConsumed").value(false))
                .andExpect(jsonPath("$.timeEnded").value(true))
                .andExpect(jsonPath("$.itemAdded").value(true))
                .andExpect(jsonPath("$.gameOver").value(true))
                .andExpect(jsonPath("$.refreshRecommended").value(true))
                .andExpect(jsonPath("$.statChanges[0].statistic").value("life"))
                .andExpect(jsonPath("$.statChanges[0].delta").value(-5))
                .andExpect(jsonPath("$.registryChanges[0].newValue").value("OPEN"))
                .andExpect(jsonPath("$.itemChanges[0].action").value("ADD"))
                // v0.29.3 — forced movement travels as movementApplied + locationChanges.
                .andExpect(jsonPath("$.movementApplied").value(true))
                .andExpect(jsonPath("$.locationChanges[0].characterUuid").value("char-1"))
                .andExpect(jsonPath("$.locationChanges[0].fromLocationUuid").value("loc-a"))
                .andExpect(jsonPath("$.locationChanges[0].toLocationUuid").value("loc-b"))
                // The narrative is the EFFECT's card, not the event's.
                .andExpect(jsonPath("$.effects[0].card.title").value("A wound"))
                .andExpect(jsonPath("$.effects[0].characterUuids[0]").value("char-1"))
                .andExpect(jsonPath("$.pendingChoices").isEmpty());
    }

    @Test
    void executeEvent_choicesPendingPayload() throws Exception {
        // Step 31: a choice-event pays and presents — no effects, options with verdicts.
        EventExecutionResult pending = new EventExecutionResult(
                "m1", "evt-1", "NORMAL", "CHOICES_PENDING", card("The Crossroads"),
                List.of("evt-1"),
                1, 0, 19, 8, 5,
                false, false, false, false, false, false, false, false, false, false,
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(),
                List.of(new EventExecutionPort.PendingChoice("choice-1", 1, "Gold Door",
                                "The shiny one.", card("Gold"), true, null),
                        new EventExecutionPort.PendingChoice("choice-2", 2, "Runes",
                                "For prodigies.", null, false, "CONDITION_STATISTICS_NOT_MET")),
                EventExecutionPort.EdgeStateOutcome.none());
        when(eventExecutionPort.executeEvent("m1", "user-uuid", "evt-1", null)).thenReturn(pending);

        mockMvc.perform(authed(post(URL)).contentType(APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CHOICES_PENDING"))
                .andExpect(jsonPath("$.energySpent").value(1))
                .andExpect(jsonPath("$.effects").isEmpty())
                .andExpect(jsonPath("$.statChanges").isEmpty())
                .andExpect(jsonPath("$.pendingChoices[0].uuid").value("choice-1"))
                .andExpect(jsonPath("$.pendingChoices[0].name").value("Gold Door"))
                .andExpect(jsonPath("$.pendingChoices[0].description").value("The shiny one."))
                .andExpect(jsonPath("$.pendingChoices[0].card.title").value("Gold"))
                .andExpect(jsonPath("$.pendingChoices[0].available").value(true))
                .andExpect(jsonPath("$.pendingChoices[1].available").value(false))
                .andExpect(jsonPath("$.pendingChoices[1].reason").value("CONDITION_STATISTICS_NOT_MET"));
    }

    @Test
    void executeEvent_forwardsLang() throws Exception {
        when(eventExecutionPort.executeEvent("m1", "user-uuid", "evt-1", "it")).thenReturn(result());

        mockMvc.perform(authed(post(URL + "?lang=it")).contentType(APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk());

        verify(eventExecutionPort).executeEvent("m1", "user-uuid", "evt-1", "it");
    }

    @Test
    void executeEvent_unauthenticated() throws Exception {
        mockMvc.perform(post(URL).contentType(APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
    }

    @Test
    void executeEvent_missingBody() throws Exception {
        mockMvc.perform(authed(post(URL)).contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MISSING_EVENT"));
    }

    @Test
    void executeEvent_blankEventUuid() throws Exception {
        mockMvc.perform(authed(post(URL)).contentType(APPLICATION_JSON)
                        .content("{\"eventUuid\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MISSING_EVENT"));
    }

    @Test
    void executeEvent_notFoundCodes() throws Exception {
        for (Code code : List.of(Code.MATCH_NOT_FOUND, Code.EVENT_NOT_FOUND)) {
            expect(code, status().isNotFound());
        }
    }

    @Test
    void executeEvent_conflictCodes() throws Exception {
        List<Code> conflicts = List.of(
                Code.MATCH_NOT_RUNNING, Code.CHARACTER_CANNOT_ACT, Code.SLEEPING, Code.COMA,
                Code.EVENT_NOT_EXECUTABLE_TYPE,
                Code.ONCE_ALREADY_CONSUMED, Code.WRONG_LOCATION, Code.NOT_ENOUGH_ENERGY,
                Code.NOT_ENOUGH_COINS, Code.REGISTRY_CONDITION_NOT_MET,
                Code.WEATHER_CONDITION_NOT_MET, Code.ITEM_CONDITION_NOT_MET,
                Code.CLASS_CONDITION_NOT_MET);

        for (Code code : conflicts) {
            expect(code, status().isConflict());
        }
    }

    // ── select-choice (Step 32) ─────────────────────────────────────────────

    private static final String CHOICE_URL = "/api/gameplay/m1/action/select-choice";
    private static final String CHOICE_BODY = "{\"choiceUuid\":\"ch-1\"}";

    private static EventExecutionPort.ChoiceResolutionResult resolution() {
        return new EventExecutionPort.ChoiceResolutionResult(
                result(), "ch-1", "evt-1", "You push the door open.", card("Open the door"),
                "evt-linked", card("Beyond the door"), true);
    }

    @Test
    void selectChoice_returns200WithTheExecutionBlockAndTheChoiceFields() throws Exception {
        when(eventExecutionPort.selectChoice("m1", "user-uuid", "ch-1", null))
                .thenReturn(resolution());

        mockMvc.perform(authed(post(CHOICE_URL)).contentType(APPLICATION_JSON).content(CHOICE_BODY))
                .andExpect(status().isOk())
                // the choice-specific block
                .andExpect(jsonPath("$.choiceUuid").value("ch-1"))
                .andExpect(jsonPath("$.eventUuid").value("evt-1"))
                .andExpect(jsonPath("$.narrative").value("You push the door open."))
                .andExpect(jsonPath("$.choiceCard.title").value("Open the door"))
                .andExpect(jsonPath("$.choiceEventUuid").value("evt-linked"))
                .andExpect(jsonPath("$.choiceEventCard.title").value("Beyond the door"))
                .andExpect(jsonPath("$.progressRecorded").value(true))
                // …carried on top of the whole execute-event payload, so the board has one path
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.statChanges[0].statistic").value("life"))
                .andExpect(jsonPath("$.registryChanges[0].key").value("GATE"))
                .andExpect(jsonPath("$.itemChanges[0].itemUuid").value("item-1"))
                .andExpect(jsonPath("$.locationChanges[0].toLocationUuid").value("loc-b"))
                .andExpect(jsonPath("$.effects[0].card.title").value("A wound"))
                .andExpect(jsonPath("$.edgeState.allPlayersInComa").value(true));
    }

    @Test
    void selectChoice_passesTheLangThrough() throws Exception {
        when(eventExecutionPort.selectChoice("m1", "user-uuid", "ch-1", "it"))
                .thenReturn(resolution());

        mockMvc.perform(authed(post(CHOICE_URL)).param("lang", "it")
                        .contentType(APPLICATION_JSON).content(CHOICE_BODY))
                .andExpect(status().isOk());

        verify(eventExecutionPort).selectChoice("m1", "user-uuid", "ch-1", "it");
    }

    @Test
    void selectChoice_unauthenticated() throws Exception {
        mockMvc.perform(post(CHOICE_URL).contentType(APPLICATION_JSON).content(CHOICE_BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
    }

    @Test
    void selectChoice_missingOrBlankChoiceUuid() throws Exception {
        for (String body : List.of("{}", "{\"choiceUuid\":\"  \"}")) {
            mockMvc.perform(authed(post(CHOICE_URL)).contentType(APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("MISSING_CHOICE"));
        }
    }

    @Test
    void selectChoice_notFoundCodes() throws Exception {
        for (Code code : List.of(Code.MATCH_NOT_FOUND, Code.EVENT_NOT_FOUND, Code.CHOICE_NOT_FOUND)) {
            expectChoice(code, status().isNotFound());
        }
    }

    @Test
    void selectChoice_conflictCodes() throws Exception {
        // Both Step 32 states are things the player can act on: open the event, or change
        // the world — never a missing entity, hence 409 and not 404.
        for (Code code : List.of(Code.CHOICE_NOT_OPEN, Code.CHOICE_NOT_AVAILABLE,
                Code.MATCH_NOT_RUNNING, Code.SLEEPING, Code.COMA)) {
            expectChoice(code, status().isConflict());
        }
    }

    private void expectChoice(Code code, org.springframework.test.web.servlet.ResultMatcher status)
            throws Exception {
        doThrow(new EventExecutionException(code, "nope"))
                .when(eventExecutionPort).selectChoice(anyString(), anyString(), anyString(), any());

        mockMvc.perform(authed(post(CHOICE_URL)).contentType(APPLICATION_JSON).content(CHOICE_BODY))
                .andExpect(status)
                .andExpect(jsonPath("$.error").value(code.name()));
    }

    /**
     * Re-stubs with doThrow, not when(...).thenThrow: the latter would CALL the already-stubbed
     * mock while building the matcher and blow up in the test instead of in the controller.
     */
    private void expect(Code code, org.springframework.test.web.servlet.ResultMatcher status)
            throws Exception {
        doThrow(new EventExecutionException(code, "nope"))
                .when(eventExecutionPort).executeEvent(anyString(), anyString(), anyString(), any());

        mockMvc.perform(authed(post(URL)).contentType(APPLICATION_JSON).content(BODY))
                .andExpect(status)
                .andExpect(jsonPath("$.error").value(code.name()));
    }
}
