package games.paths.core.model.match.export;

import games.paths.core.service.story.StoryFingerprint;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** v0.41.4 test fixture: the shared sample match export (also used by python/aws), fingerprint and checksum set. */
public final class MatchExportSamples {

    private MatchExportSamples() {
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> document() {
        try (InputStream in = MatchExportSamples.class.getResourceAsStream("/match-export/match-export-sample.json")) {
            Map<String, Object> doc = (Map<String, Object>) CanonicalJson.parse(
                    new String(in.readAllBytes(), StandardCharsets.UTF_8));
            Map<String, Object> story = section(doc, "story");
            story.put("fingerprint", StoryFingerprint.of(section(story, "data")));
            return withChecksum(doc);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static Map<String, Object> withChecksum(Map<String, Object> doc) {
        Map<String, Object> body = new LinkedHashMap<>(doc);
        body.remove("checksum");
        doc.put("checksum", CanonicalJson.sha256(body));
        return doc;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> section(Map<String, Object> doc, String key) {
        return (Map<String, Object>) doc.get(key);
    }

    @SuppressWarnings("unchecked")
    public static List<Object> list(Map<String, Object> doc, String key) {
        return (List<Object>) doc.get(key);
    }
}
