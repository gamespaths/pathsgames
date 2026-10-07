package games.paths.adapters.admin.controller.story;

import games.paths.core.model.story.CatalogExportResult;
import games.paths.core.port.story.StoryCatalogExportPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Unit tests for {@link StoryCatalogAdminController} (v0.37.6). */
class StoryCatalogAdminControllerTest {

    private MockMvc mockMvc;
    private StoryCatalogExportPort exportPort;

    @BeforeEach
    void setup() {
        exportPort = mock(StoryCatalogExportPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new StoryCatalogAdminController(exportPort)).build();
    }

    @Test
    @DisplayName("POST /api/admin/stories/catalog → 200 WRITTEN with files[]")
    void writesCatalog() throws Exception {
        when(exportPort.exportCatalog()).thenReturn(new CatalogExportResult("/srv/site", List.of(
                new CatalogExportResult.CatalogFile("en", "data/stories-en.json", 3, 999))));

        mockMvc.perform(post("/api/admin/stories/catalog"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("WRITTEN")))
                .andExpect(jsonPath("$.target", is("/srv/site")))
                .andExpect(jsonPath("$.files", hasSize(1)))
                .andExpect(jsonPath("$.files[0].lang", is("en")))
                .andExpect(jsonPath("$.files[0].path", is("data/stories-en.json")))
                .andExpect(jsonPath("$.files[0].count", is(3)))
                .andExpect(jsonPath("$.files[0].bytes", is(999)));
    }

    @Test
    @DisplayName("No destination configured → 503 CATALOG_TARGET_NOT_CONFIGURED")
    void notConfigured() throws Exception {
        when(exportPort.exportCatalog()).thenThrow(new StoryCatalogExportPort.CatalogNotConfiguredException());

        mockMvc.perform(post("/api/admin/stories/catalog"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error", is("CATALOG_TARGET_NOT_CONFIGURED")))
                .andExpect(jsonPath("$.message", containsString("CATALOG_EXPORT_DIR")));
    }
}
