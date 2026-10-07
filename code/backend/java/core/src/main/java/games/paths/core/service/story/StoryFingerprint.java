package games.paths.core.service.story;

import games.paths.core.model.match.export.CanonicalJson;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * StoryFingerprint - v0.41.4 SHA-256 of the canonical story projection: uuid/tsInsert/tsUpdate/idStory
 * dropped at any depth (and the root server id), nulls dropped, arrays of objects sorted by id.
 */
public final class StoryFingerprint {

    private static final Set<String> DROPPED = Set.of("uuid", "tsInsert", "tsUpdate", "idStory");

    private StoryFingerprint() {
    }

    public static String of(Map<String, Object> storyData) {
        return CanonicalJson.sha256(projection(storyData));
    }

    /** The projection the fingerprint is taken on. */
    public static Map<String, Object> projection(Map<String, Object> storyData) {
        @SuppressWarnings("unchecked")
        Map<String, Object> root = (Map<String, Object>) project(storyData == null ? Map.of() : storyData);
        root.remove("id");
        return root;
    }

    private static Object project(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            map.forEach((k, v) -> {
                String key = String.valueOf(k);
                if (v != null && !DROPPED.contains(key)) {
                    out.put(key, project(v));
                }
            });
            return out;
        }
        if (value instanceof List<?> list) {
            List<Object> out = new ArrayList<>(list.size());
            list.forEach(v -> out.add(project(v)));
            if (out.stream().allMatch(v -> v instanceof Map<?, ?>)) {
                out.sort(ORDER);
            }
            return out;
        }
        return value;
    }

    private static final Comparator<Object> ORDER = (a, b) -> {
        Map<?, ?> x = (Map<?, ?>) a;
        Map<?, ?> y = (Map<?, ?>) b;
        for (String key : List.of("id", "idText", "lang")) {
            int c = compareValues(x.get(key), y.get(key));
            if (c != 0) {
                return c;
            }
        }
        return CanonicalJson.compareCodePoints(CanonicalJson.write(a), CanonicalJson.write(b));
    };

    /** Absent first, then numbers by value, then text by code point (python sorts the same tuple). */
    static int compareValues(Object a, Object b) {
        int ra = rank(a);
        int rb = rank(b);
        if (ra != rb) {
            return Integer.compare(ra, rb);
        }
        if (ra == 1) {
            return new java.math.BigDecimal(a.toString()).compareTo(new java.math.BigDecimal(b.toString()));
        }
        if (ra == 2) {
            return CanonicalJson.compareCodePoints(String.valueOf(a), String.valueOf(b));
        }
        return 0;
    }

    private static int rank(Object v) {
        if (v == null) {
            return 0;
        }
        return v instanceof Number && !(v instanceof Boolean) ? 1 : 2;
    }
}
