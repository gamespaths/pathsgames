package games.paths.adapters.rest.controller.match;

import games.paths.core.port.match.ExperiencePort;
import games.paths.core.port.match.ExperiencePort.ExperienceException;
import games.paths.core.port.match.ExperiencePort.ExperienceException.Code;
import games.paths.core.port.match.ExperiencePort.StatChange;
import games.paths.core.port.match.ExperiencePort.UseExpResult;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** ExperienceController (Step 38) — POST /api/gameplay/{uuidMatch}/action/use-exp. */
@DisplayName("ExperienceController (Step 38)")
class ExperienceControllerTest {

    private static final String USE = "/api/gameplay/m1/action/use-exp";

    private MockMvc mockMvc;
    private ExperiencePort experiencePort;

    @BeforeEach
    void setUp() {
        experiencePort = mock(ExperiencePort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new ExperienceController(experiencePort)).build();
    }

    private static MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    private static UseExpResult result() {
        Map<String, Integer> costs = new LinkedHashMap<>();
        costs.put("dex", 13);
        costs.put("int", null);
        costs.put("cos", 4);
        return new UseExpResult("m1", "c1", "dex", 12, 13, 40, 28, 12, costs,
                List.of(new StatChange("c1", "dex", 12, 13, 1), new StatChange("c1", "exp", 40, 28, -12)));
    }

    @Test
    @DisplayName("200 with the purchase, the refreshed price list and the two stat changes")
    void ok() throws Exception {
        when(experiencePort.useExp("m1", "user-uuid", "dex")).thenReturn(result());

        mockMvc.perform(authed(post(USE).contentType(APPLICATION_JSON).content("{\"stat\":\"dex\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.characterUuid").value("c1"))
                .andExpect(jsonPath("$.stat").value("dex"))
                .andExpect(jsonPath("$.statBefore").value(12))
                .andExpect(jsonPath("$.statAfter").value(13))
                .andExpect(jsonPath("$.expBefore").value(40))
                .andExpect(jsonPath("$.expAfter").value(28))
                .andExpect(jsonPath("$.expCost").value(12))
                .andExpect(jsonPath("$.expCosts.dex").value(13))
                .andExpect(jsonPath("$.expCosts.int").isEmpty())
                .andExpect(jsonPath("$.statChanges[0].statistic").value("dex"))
                .andExpect(jsonPath("$.statChanges[1].statistic").value("exp"))
                .andExpect(jsonPath("$.statChanges[1].delta").value(-12));
        verify(experiencePort).useExp(eq("m1"), eq("user-uuid"), eq("dex"));
    }

    @Test
    @DisplayName("401 without a user identity")
    void unauthenticated() throws Exception {
        mockMvc.perform(post(USE).contentType(APPLICATION_JSON).content("{\"stat\":\"dex\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verifyNoInteractions(experiencePort);
    }

    @Test
    @DisplayName("400 INVALID_STAT when the body or its stat is missing")
    void missingStat() throws Exception {
        mockMvc.perform(authed(post(USE).contentType(APPLICATION_JSON).content("{}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_STAT"));
        mockMvc.perform(authed(post(USE).contentType(APPLICATION_JSON).content("{\"stat\":\"  \"}")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(authed(post(USE)))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(experiencePort);
    }

    @ParameterizedTest
    @EnumSource(Code.class)
    @DisplayName("every code maps: 404 missing entity, 400 wrong stat, 409 actionable state")
    void everyCodeIsMapped(Code code) throws Exception {
        when(experiencePort.useExp(anyString(), anyString(), anyString()))
                .thenThrow(new ExperienceException(code, "boom"));
        int expected = switch (code) {
            case MATCH_NOT_FOUND -> 404;
            case INVALID_STAT -> 400;
            default -> 409;
        };
        mockMvc.perform(authed(post(USE).contentType(APPLICATION_JSON).content("{\"stat\":\"life\"}")))
                .andExpect(status().is(expected))
                .andExpect(jsonPath("$.error").value(code.name()))
                .andExpect(jsonPath("$.message").value("boom"));
    }
}
