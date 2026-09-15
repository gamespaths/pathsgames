package games.paths.adapters.admin.catalog;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import games.paths.adapters.rest.dto.StorySummaryResponse;
import games.paths.core.model.story.StorySummary;
import games.paths.core.port.story.CatalogWriterPort;

/**
 * FileCatalogWriter - v0.37.6 writes the static catalog under a local directory
 * (`game.catalog.export-dir`, env `CATALOG_EXPORT_DIR`); empty = not configured.
 */
@Component
public class FileCatalogWriter implements CatalogWriterPort {

    private final Path exportDir;
    private final ObjectMapper objectMapper;

    public FileCatalogWriter(@Value("${game.catalog.export-dir:}") String exportDir, ObjectMapper objectMapper) {
        this.exportDir = exportDir == null || exportDir.isBlank() ? null : Path.of(exportDir);
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean isConfigured() {
        return exportDir != null;
    }

    @Override
    public String target() {
        return exportDir == null ? null : exportDir.toAbsolutePath().toString();
    }

    @Override
    public int write(String relativePath, List<StorySummary> stories) {
        // Same DTO and same ObjectMapper as GET /api/stories → byte-identical body.
        List<StorySummaryResponse> body = stories.stream().map(StorySummaryResponse::fromModel).toList();
        try {
            byte[] bytes = objectMapper.writeValueAsString(body).getBytes(StandardCharsets.UTF_8);
            Path file = exportDir.resolve(relativePath);
            Files.createDirectories(file.getParent());
            Files.write(file, bytes);
            return bytes.length;
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialise the story catalog", e);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
