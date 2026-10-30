package games.paths.adapters.rest.advice;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import games.paths.core.model.match.RequestStamp;
import games.paths.core.model.match.StaleMatchException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** v1.7.0 step 8 the 409 STALE_MATCH body and matchVersion added to the answers of a claiming request. */
class MatchVersionAdviceTest {

    private final MatchVersionAdvice advice = new MatchVersionAdvice(new ObjectMapper());

    @AfterEach
    void close() {
        RequestStamp.close();
    }

    public static class Dto {
        private final String uuid = "m";
        public String getUuid() { return uuid; }
    }

    @RestController
    static class Probe {
        @GetMapping("/stale")
        public Object stale() {
            throw new StaleMatchException("m", "v9");
        }

        @GetMapping("/claimed")
        public Object claimed() {
            RequestStamp.recordClaim("m", "v2");
            return new Dto();
        }

        @GetMapping("/plain")
        public Object plain() {
            return Map.of("uuid", "m");
        }
    }

    private MockMvc mvc() {
        return MockMvcBuilders.standaloneSetup(new Probe()).setControllerAdvice(advice).build();
    }

    @Test
    void aStaleClaimAnswers409WithTheCurrentVersion() throws Exception {
        mvc().perform(get("/stale"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("STALE_MATCH"))
                .andExpect(jsonPath("$.matchVersion").value("v9"))
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void theAnswerOfAClaimingRequestCarriesTheNewVersion() throws Exception {
        RequestStamp.open();
        mvc().perform(get("/claimed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uuid").value("m"))
                .andExpect(jsonPath("$.matchVersion").value("v2"));
    }

    @Test
    void withoutAClaimTheAnswerIsUntouched() throws Exception {
        mvc().perform(get("/plain"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchVersion").doesNotExist());
    }

    @Test
    void onlyJsonObjectsGetTheVersion() {
        assertNull(advice.withVersion(null, "v"));
        assertEquals("v", ((Map<?, ?>) advice.withVersion(Map.of("a", 1), "v")).get("matchVersion"));
        Map<String, Object> already = Map.of("matchVersion", "old");
        assertSame(already, advice.withVersion(already, "v"));
        List<String> list = List.of("x");
        assertSame(list, advice.withVersion(list, "v"));
        assertEquals("v", ((ObjectNode) advice.withVersion(new Dto(), "v")).get("matchVersion").asText());
        ObjectNode withField = new ObjectMapper().createObjectNode().put("matchVersion", "old");
        assertSame(withField, advice.withVersion(withField, "v"));
    }

    @Test
    void onlyTheJsonConverterIsAdvised() {
        assertTrue(advice.supports(null, MappingJackson2HttpMessageConverter.class));
        assertFalse(advice.supports(null, StringHttpMessageConverter.class));
        RequestStamp.open();
        RequestStamp.recordClaim("m", "v3");
        Object out = advice.beforeBodyWrite(Map.of(), null, MediaType.APPLICATION_JSON, null, null, null);
        assertEquals("v3", ((Map<?, ?>) out).get("matchVersion"));
        ResponseEntity<Object> r = advice.stale(new StaleMatchException("m", null));
        assertEquals(HttpStatus.CONFLICT, r.getStatusCode());
    }
}
