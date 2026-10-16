package games.paths.adapters.rest.openapi;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.core.models.ParseOptions;
import io.swagger.v3.parser.core.models.SwaggerParseResult;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Parses every OpenAPI spec of the REST adapter with external $refs resolved:
 * any parser message (syntax, schema, broken reference) fails the build.
 */
class OpenApiSpecsValidTest {

    private static final Path SPECS_DIR = Path.of("src", "main", "resources", "openapi");

    static Stream<Path> specs() throws IOException {
        try (Stream<Path> files = Files.list(SPECS_DIR)) {
            return files.filter(f -> f.getFileName().toString().endsWith(".yaml"))
                    .sorted()
                    .toList()
                    .stream();
        }
    }

    @Test
    void specsDirectoryHasYamlFiles() throws IOException {
        assertFalse(specs().toList().isEmpty(), "no OpenAPI spec found in " + SPECS_DIR.toAbsolutePath());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("specs")
    void specIsValidOpenApi(Path spec) {
        ParseOptions options = new ParseOptions();
        options.setResolve(true);
        SwaggerParseResult result = new OpenAPIV3Parser().readLocation(spec.toUri().toString(), null, options);

        assertNotNull(result.getOpenAPI(), spec + " could not be parsed");
        List<String> messages = result.getMessages() == null ? List.of() : result.getMessages();
        assertTrue(messages.isEmpty(), spec.getFileName() + " has errors: " + messages);
    }
}
