package games.paths.core.model.match.export;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** v0.41.4 — the schema keywords the match export uses, on the bundled match-export-v1 schema. */
@DisplayName("SchemaValidator (v0.41.4)")
class SchemaValidatorTest {

    private final SchemaValidator validator = SchemaValidator.matchExportV1();

    @Test
    void theBundledCopyIsTheOpenApiSchema() throws IOException {
        Path openapi = Path.of("..", "adapter-rest", "src", "main", "resources", "openapi", "match-export-v1.schema.json");
        try (InputStream in = SchemaValidator.class.getResourceAsStream(SchemaValidator.RESOURCE)) {
            assertEquals(CanonicalJson.parse(Files.readString(openapi)), CanonicalJson.parse(new String(in.readAllBytes())));
        }
    }

    @Test
    void theSampleDocumentIsValid() {
        assertEquals(List.of(), validator.validate(MatchExportSamples.document()));
    }

    @Test
    void reportsEveryKindOfProblem() {
        Map<String, Object> doc = MatchExportSamples.document();
        doc.put("format", "other");
        doc.put("extra", 1);
        doc.remove("logs");
        Map<String, Object> match = MatchExportSamples.section(doc, "match");
        match.put("uuid", "NOT-A-UUID");
        match.put("difficultyId", 0);
        match.put("status", "LOST");
        match.put("singlePlayer", "yes");
        doc.put("users", List.of());
        Map<String, Object> engine = MatchExportSamples.section(doc, "engine");
        engine.put("visitedLocationIds", List.of(1, 1));
        List<String> errors = validator.validate(doc);
        String all = String.join("\n", errors);
        assertTrue(all.contains("$: must be paths-games-match-export") || all.contains("$.format: must be"), all);
        assertTrue(all.contains("unknown property extra"), all);
        assertTrue(all.contains("missing logs"), all);
        assertTrue(all.contains("does not match"), all);
        assertTrue(all.contains("must be >= 1"), all);
        assertTrue(all.contains("must be one of"), all);
        assertTrue(all.contains("must be boolean"), all);
        assertTrue(all.contains("needs at least 1 items"), all);
        assertTrue(all.contains("items are not unique"), all);
    }

    @Test
    void stopsAtTwentyErrorsAndChecksIntegerTypes() {
        Map<String, Object> doc = MatchExportSamples.document();
        doc.put("logs", java.util.Collections.nCopies(30, Map.of("type", "NOPE")));
        assertEquals(20, validator.validate(doc).size());
        assertTrue(SchemaValidator.isInteger(BigInteger.ONE));
        assertTrue(SchemaValidator.isInteger((short) 1));
        assertTrue(SchemaValidator.isInteger((byte) 1));
        assertFalse(SchemaValidator.isInteger(1.0));
        assertTrue(SchemaValidator.hasType("number", 1.5));
        assertTrue(SchemaValidator.hasType("null", null));
    }

    @Test
    void aMinimalSchemaHandlesConstAndUnknownRefs() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("const", 1);
        SchemaValidator v = new SchemaValidator(schema);
        assertEquals(List.of(), v.validate(1L));
        assertEquals(1, v.validate(1.0).size());
        assertEquals(1, v.validate("1").size());
        assertEquals(List.of(), new SchemaValidator(Map.of("$ref", "elsewhere")).validate("x"));
    }
}
