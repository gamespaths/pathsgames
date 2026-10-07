package games.paths.core.service.story;

import games.paths.core.port.story.StoryCrudPort;
import games.paths.core.port.story.StoryExportPort;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * StoryExportService - v0.41.4 the header plus the 22 admin CRUD lists, tsInsert/tsUpdate/idStory removed,
 * text ids fixed and nulls stripped: what react-admin StoriesPage.handleExport writes.
 */
public class StoryExportService implements StoryExportPort {

    /** Admin CRUD entity type and JSON key, in the react-admin export order. */
    public static final List<Map.Entry<String, String>> ENTITY_TYPES = List.of(
            Map.entry("texts", "texts"), Map.entry("difficulties", "difficulties"),
            Map.entry("classes", "classes"), Map.entry("locations", "locations"),
            Map.entry("events", "events"), Map.entry("items", "items"),
            Map.entry("choices", "choices"), Map.entry("creators", "creators"),
            Map.entry("cards", "cards"), Map.entry("keys", "keys"),
            Map.entry("traits", "traits"), Map.entry("character-templates", "characterTemplates"),
            Map.entry("weather-rules", "weatherRules"), Map.entry("global-random-events", "globalRandomEvents"),
            Map.entry("missions", "missions"), Map.entry("location-neighbors", "locationNeighbors"),
            Map.entry("event-effects", "eventEffects"), Map.entry("choice-conditions", "choiceConditions"),
            Map.entry("choice-effects", "choiceEffects"), Map.entry("item-effects", "itemEffects"),
            Map.entry("class-bonuses", "classBonuses"), Map.entry("mission-steps", "missionSteps"));

    private static final List<String> DROPPED = List.of("tsInsert", "tsUpdate", "idStory");

    private final StoryCrudPort crud;

    public StoryExportService(StoryCrudPort crud) {
        this.crud = crud;
    }

    @Override
    public Map<String, Object> exportStory(String storyUuid) {
        Map<String, Object> header = crud.getStory(storyUuid);
        if (header == null) {
            return null;
        }
        Map<String, Object> data = new LinkedHashMap<>(header);
        data.remove("tsInsert");
        data.remove("tsUpdate");
        for (Map.Entry<String, String> type : ENTITY_TYPES) {
            List<Map<String, Object>> rows = crud.listEntities(storyUuid, type.getKey());
            List<Object> out = new ArrayList<>();
            for (Map<String, Object> row : rows == null ? List.<Map<String, Object>>of() : rows) {
                out.add(entity(type.getValue(), row));
            }
            data.put(type.getValue(), out);
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> clean = (Map<String, Object>) stripNulls(data);
        return clean;
    }

    private static Map<String, Object> entity(String jsonKey, Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>(row);
        DROPPED.forEach(out::remove);
        Object idText = row.get("idText");
        if ("texts".equals(jsonKey) && idText != null) {
            Long id = asLong(idText);
            out.put("id", id);
            out.put("idText", id);
        }
        return out;
    }

    /** Null-valued keys removed at any depth; arrays keep their length. */
    @SuppressWarnings("unchecked")
    public static Object stripNulls(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            map.forEach((k, v) -> {
                if (v != null) {
                    out.put(String.valueOf(k), stripNulls(v));
                }
            });
            return out;
        }
        if (value instanceof List<?> list) {
            List<Object> out = new ArrayList<>(list.size());
            list.forEach(v -> out.add(stripNulls(v)));
            return out;
        }
        return value;
    }

    static Long asLong(Object value) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
