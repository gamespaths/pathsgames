package games.paths.adapters.rest.controller.match;

import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.EventExecutionPort.EdgeStateOutcome;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionPort.StatChange;
import games.paths.core.port.match.InventoryPort;
import games.paths.core.port.match.InventoryPort.DropItemResult;
import games.paths.core.port.match.InventoryPort.InventoryException;
import games.paths.core.port.match.InventoryPort.InventoryException.Code;
import games.paths.core.port.match.InventoryPort.InventoryView;
import games.paths.core.port.match.InventoryPort.ResourcesView;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** InventoryController (Steps 34 & 35) — the four gameplay inventory endpoints. */
@DisplayName("InventoryController (Steps 34 & 35)")
class InventoryControllerTest {

    private static final String INVENTORY = "/api/gameplay/m1/inventory";
    private static final String USE = "/api/gameplay/m1/inventory/use-item";
    private static final String DROP = "/api/gameplay/m1/inventory/drop-item";
    private static final String RESOURCES = "/api/gameplay/m1/resources";
    private static final String BODY = "{\"itemInstanceUuid\":\"row-1\"}";

    private MockMvc mockMvc;
    private InventoryPort inventoryPort;

    @BeforeEach
    void setUp() {
        inventoryPort = mock(InventoryPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new InventoryController(inventoryPort)).build();
    }

    private static MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    private static CardInfo card() {
        return new CardInfo("card-77", "item", null, null, "fas fa-box",
                null, null, null, null, null, "A potion", "desc", null, null, null);
    }

    private static ItemInstanceInfo itemInfo() {
        ItemInstanceInfo i = new ItemInstanceInfo();
        i.setUuid("row-1");
        i.setItemUuid("item-900");
        i.setName("Potion");
        i.setWeight(3);
        i.setAmount(2);
        i.setState("ACTIVE");
        i.setIdCard(77);
        i.setCard(card());
        i.setIsConsumabile(true);
        return i;
    }

    /** The use-item payload: an execute-event result with no owning event. */
    private static EventExecutionResult usageResult() {
        return new EventExecutionResult("m1", null, null, "APPLIED", card(), List.of(),
                0, 0, 0, 0, 17, 8, 4, 6, 5, false, false, false, false, false, false, false, false, false, true,
                List.of(new StatChange("char-1", "life", 30, 33, 3)),
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                EdgeStateOutcome.none(), List.of());
    }

    @Nested
    @DisplayName("happy paths")
    class HappyPaths {

        @Test
        void inventory_returnsItemsWeightAndCapacity() throws Exception {
            when(inventoryPort.listInventory("m1", "user-uuid", "it"))
                    .thenReturn(new InventoryView("m1", "char-1", List.of(itemInfo()), 6, 30));

            mockMvc.perform(authed(get(INVENTORY).param("lang", "it")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.matchUuid").value("m1"))
                    .andExpect(jsonPath("$.characterUuid").value("char-1"))
                    .andExpect(jsonPath("$.weight").value(6))
                    .andExpect(jsonPath("$.weightMax").value(30))
                    .andExpect(jsonPath("$.items[0].uuid").value("row-1"))
                    .andExpect(jsonPath("$.items[0].itemUuid").value("item-900"))
                    .andExpect(jsonPath("$.items[0].idCard").value(77))
                    .andExpect(jsonPath("$.items[0].card.uuid").value("card-77"))
                    .andExpect(jsonPath("$.items[0].isConsumabile").value(true));
        }

        @Test
        @DisplayName("use-item answers the execute-event shape, with a null eventUuid")
        void useItem_answersTheExecuteEventShape() throws Exception {
            when(inventoryPort.useItem("m1", "user-uuid", "row-1", null)).thenReturn(usageResult());

            mockMvc.perform(authed(post(USE).contentType(APPLICATION_JSON).content(BODY)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("APPLIED"))
                    .andExpect(jsonPath("$.eventUuid").doesNotExist())
                    .andExpect(jsonPath("$.card.uuid").value("card-77"))
                    .andExpect(jsonPath("$.statChanges[0].statistic").value("life"))
                    .andExpect(jsonPath("$.pendingChoices").isEmpty());
        }

        @Test
        void useItem_forwardsTheLanguage() throws Exception {
            when(inventoryPort.useItem("m1", "user-uuid", "row-1", "it")).thenReturn(usageResult());

            mockMvc.perform(authed(post(USE).param("lang", "it")
                            .contentType(APPLICATION_JSON).content(BODY)))
                    .andExpect(status().isOk());

            verify(inventoryPort).useItem("m1", "user-uuid", "row-1", "it");
        }

        @Test
        void dropItem_reportsWhatLeftTheInventory() throws Exception {
            when(inventoryPort.dropItem("m1", "user-uuid", "row-1"))
                    .thenReturn(new DropItemResult("m1", "char-1", "row-1", "item-900", 3, 0, 30));

            mockMvc.perform(authed(post(DROP).contentType(APPLICATION_JSON).content(BODY)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.itemInstanceUuid").value("row-1"))
                    .andExpect(jsonPath("$.itemUuid").value("item-900"))
                    .andExpect(jsonPath("$.amountDropped").value(3))
                    .andExpect(jsonPath("$.weight").value(0))
                    .andExpect(jsonPath("$.refreshRecommended").value(true));
        }

        @Test
        @DisplayName("resources are plain numbers and carry no card")
        void resources_arePlainNumbers() throws Exception {
            when(inventoryPort.getResources("m1", "user-uuid"))
                    .thenReturn(new ResourcesView("m1", "char-1", 4, 2, 9, 6, 30));

            mockMvc.perform(authed(get(RESOURCES)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.food").value(4))
                    .andExpect(jsonPath("$.magic").value(2))
                    .andExpect(jsonPath("$.coin").value(9))
                    .andExpect(jsonPath("$.weight").value(6))
                    .andExpect(jsonPath("$.weightMax").value(30))
                    .andExpect(jsonPath("$.card").doesNotExist());
        }
    }

    @Nested
    @DisplayName("request validation")
    class RequestValidation {

        @Test
        void everyEndpointRefusesAnAnonymousCaller() throws Exception {
            mockMvc.perform(get(INVENTORY)).andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
            mockMvc.perform(post(USE).contentType(APPLICATION_JSON).content(BODY))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(post(DROP).contentType(APPLICATION_JSON).content(BODY))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(get(RESOURCES)).andExpect(status().isUnauthorized());
            verifyNoInteractions(inventoryPort);
        }

        @Test
        @DisplayName("a blank userUuid attribute counts as anonymous")
        void blankUserUuid() throws Exception {
            mockMvc.perform(get(INVENTORY).requestAttr("userUuid", "  "))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        void useAndDropRequireTheRowUuid() throws Exception {
            for (String url : new String[]{USE, DROP}) {
                mockMvc.perform(authed(post(url).contentType(APPLICATION_JSON).content("{}")))
                        .andExpect(status().isBadRequest())
                        .andExpect(jsonPath("$.error").value("MISSING_ITEM"));
                mockMvc.perform(authed(post(url).contentType(APPLICATION_JSON)
                                .content("{\"itemInstanceUuid\":\"  \"}")))
                        .andExpect(status().isBadRequest());
            }
            verifyNoInteractions(inventoryPort);
        }
    }

    @Nested
    @DisplayName("error mapping")
    class ErrorMapping {

        @ParameterizedTest
        @EnumSource(Code.class)
        @DisplayName("every code maps to 404 for a missing entity, 409 for an actionable state")
        void everyCodeIsMapped(Code code) throws Exception {
            when(inventoryPort.useItem(anyString(), anyString(), anyString(), any()))
                    .thenThrow(new InventoryException(code, "boom"));

            int expected = (code == Code.MATCH_NOT_FOUND || code == Code.ITEM_NOT_FOUND) ? 404 : 409;

            mockMvc.perform(authed(post(USE).contentType(APPLICATION_JSON).content(BODY)))
                    .andExpect(status().is(expected))
                    .andExpect(jsonPath("$.error").value(code.name()))
                    .andExpect(jsonPath("$.message").value("boom"))
                    .andExpect(jsonPath("$.timestamp").exists());
        }

        @Test
        void readEndpointsMapTheirErrorsToo() throws Exception {
            when(inventoryPort.listInventory(anyString(), anyString(), any()))
                    .thenThrow(new InventoryException(Code.MATCH_NOT_FOUND, "gone"));
            when(inventoryPort.getResources(anyString(), anyString()))
                    .thenThrow(new InventoryException(Code.MATCH_NOT_FOUND, "gone"));
            when(inventoryPort.dropItem(anyString(), anyString(), anyString()))
                    .thenThrow(new InventoryException(Code.ITEM_NOT_FOUND, "gone"));

            mockMvc.perform(authed(get(INVENTORY))).andExpect(status().isNotFound());
            mockMvc.perform(authed(get(RESOURCES))).andExpect(status().isNotFound());
            mockMvc.perform(authed(post(DROP).contentType(APPLICATION_JSON).content(BODY)))
                    .andExpect(status().isNotFound());
        }
    }
}
