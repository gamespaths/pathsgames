package games.paths.adapters.admin.controller.match;

import games.paths.core.port.match.KpiPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** v0.41.2 — GET /api/admin/reports/kpi: the report body and the 400 INVALID_INPUT. */
class KpiAdminControllerTest {

    private MockMvc mockMvc;
    private KpiPort kpiPort;

    @BeforeEach
    void setUp() {
        kpiPort = mock(KpiPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new KpiAdminController(kpiPort)).build();
    }

    @Test
    void answersTheReport() throws Exception {
        when(kpiPort.report("s-1", "2026-09-01", "2026-09-02", "total")).thenReturn(new KpiPort.KpiReport(
                "s-1", "2026-09-01", "2026-09-02", "total",
                List.of(new KpiPort.KpiRow("total", 2, 1, 0.5, 1.25, 3.0, 1),
                        new KpiPort.KpiRow("x", 0, 0, null, null, null, 0)),
                List.of(new KpiPort.KpiCount("c-1", 4)), List.of(new KpiPort.KpiCount("l-1", 1)),
                List.of(new KpiPort.KpiMission("m-1", 1, 1, 0))));

        mockMvc.perform(get("/api/admin/reports/kpi").param("storyUuid", "s-1").param("from", "2026-09-01")
                        .param("to", "2026-09-02").param("groupBy", "total"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storyUuid").value("s-1"))
                .andExpect(jsonPath("$.groupBy").value("total"))
                .andExpect(jsonPath("$.rows[0].period").value("total"))
                .andExpect(jsonPath("$.rows[0].matchesStarted").value(2))
                .andExpect(jsonPath("$.rows[0].matchesCompleted").value(1))
                .andExpect(jsonPath("$.rows[0].completionRate").value(0.5))
                .andExpect(jsonPath("$.rows[0].avgDurationMinutes").value(1.25))
                .andExpect(jsonPath("$.rows[0].avgDurationClocks").value(3.0))
                .andExpect(jsonPath("$.rows[0].comaCount").value(1))
                .andExpect(jsonPath("$.rows[1].completionRate").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.choices[0].uuid").value("c-1"))
                .andExpect(jsonPath("$.choices[0].count").value(4))
                .andExpect(jsonPath("$.locations[0].uuid").value("l-1"))
                .andExpect(jsonPath("$.missions[0].activated").value(1))
                .andExpect(jsonPath("$.missions[0].completed").value(1))
                .andExpect(jsonPath("$.missions[0].failed").value(0));
    }

    @Test
    void badInputIs400() throws Exception {
        when(kpiPort.report(null, "nope", null, null)).thenThrow(new KpiPort.KpiException("from must be a date"));

        mockMvc.perform(get("/api/admin/reports/kpi").param("from", "nope"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.message").value("from must be a date"));
    }
}
