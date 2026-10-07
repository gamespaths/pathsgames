package games.paths.core.model.match.export;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * SchemaValidator - v0.41.4 the JSON Schema keywords match-export-v1.schema.json uses (type, required,
 * properties, additionalProperties, items, enum, const, pattern, minimum, minItems, uniqueItems, $ref).
 */
public final class SchemaValidator {

    public static final String RESOURCE = "/match-export/match-export-v1.schema.json";
    private static final int MAX_ERRORS = 20;
    private static final String DEFS = "#/$defs/";

    private final Map<String, Object> root;

    public SchemaValidator(Map<String, Object> schema) {
        this.root = schema;
    }

    /** The bundled match export v1 schema. */
    @SuppressWarnings("unchecked")
    public static SchemaValidator matchExportV1() {
        try (InputStream in = SchemaValidator.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("Missing schema resource " + RESOURCE);
            }
            return new SchemaValidator((Map<String, Object>) CanonicalJson.parse(
                    new String(in.readAllBytes(), StandardCharsets.UTF_8)));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** At most twenty "path: problem" lines; empty when the value is valid. */
    public List<String> validate(Object value) {
        List<String> errors = new ArrayList<>();
        check(root, value, "$", errors);
        return errors;
    }

    @SuppressWarnings("unchecked")
    private void check(Map<String, Object> schema, Object value, String path, List<String> errors) {
        if (errors.size() >= MAX_ERRORS || schema == null) {
            return;
        }
        Object ref = schema.get("$ref");
        if (ref instanceof String r && r.startsWith(DEFS)) {
            Map<String, Object> defs = (Map<String, Object>) root.get("$defs");
            check((Map<String, Object>) defs.get(r.substring(DEFS.length())), value, path, errors);
            return;
        }
        if (schema.containsKey("const") && !same(schema.get("const"), value)) {
            errors.add(path + ": must be " + schema.get("const"));
            return;
        }
        if (schema.get("enum") instanceof List<?> options && options.stream().noneMatch(o -> same(o, value))) {
            errors.add(path + ": must be one of " + options);
            return;
        }
        Object type = schema.get("type");
        if (type instanceof String t && !hasType(t, value)) {
            errors.add(path + ": must be " + t);
            return;
        }
        if (value instanceof Map<?, ?> map) {
            checkObject(schema, (Map<String, Object>) map, path, errors);
        } else if (value instanceof List<?> list) {
            checkArray(schema, list, path, errors);
        } else if (value instanceof String s && schema.get("pattern") instanceof String p
                && !Pattern.compile(p).matcher(s).find()) {
            errors.add(path + ": does not match " + p);
        } else if (value instanceof Number n && schema.get("minimum") instanceof Number min
                && new BigInteger(CanonicalJson.number(n)).compareTo(BigInteger.valueOf(min.longValue())) < 0) {
            errors.add(path + ": must be >= " + min);
        }
    }

    @SuppressWarnings("unchecked")
    private void checkObject(Map<String, Object> schema, Map<String, Object> map, String path, List<String> errors) {
        if (schema.get("required") instanceof List<?> required) {
            for (Object key : required) {
                if (!map.containsKey(String.valueOf(key)) || map.get(String.valueOf(key)) == null) {
                    errors.add(path + ": missing " + key);
                }
            }
        }
        Map<String, Object> properties = schema.get("properties") instanceof Map<?, ?> p
                ? (Map<String, Object>) p : Map.of();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (entry.getValue() == null) {
                continue;
            }
            Object sub = properties.get(entry.getKey());
            if (sub instanceof Map<?, ?> subSchema) {
                check((Map<String, Object>) subSchema, entry.getValue(), path + "." + entry.getKey(), errors);
            } else if (Boolean.FALSE.equals(schema.get("additionalProperties"))) {
                errors.add(path + ": unknown property " + entry.getKey());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void checkArray(Map<String, Object> schema, List<?> list, String path, List<String> errors) {
        if (schema.get("minItems") instanceof Number min && list.size() < min.intValue()) {
            errors.add(path + ": needs at least " + min + " items");
        }
        if (Boolean.TRUE.equals(schema.get("uniqueItems"))) {
            Set<String> seen = new HashSet<>();
            for (Object item : list) {
                if (!seen.add(CanonicalJson.write(item))) {
                    errors.add(path + ": items are not unique");
                    break;
                }
            }
        }
        if (schema.get("items") instanceof Map<?, ?> items) {
            for (int i = 0; i < list.size(); i++) {
                check((Map<String, Object>) items, list.get(i), path + "[" + i + "]", errors);
            }
        }
    }

    static boolean hasType(String type, Object value) {
        return switch (type) {
            case "object" -> value instanceof Map<?, ?>;
            case "array" -> value instanceof List<?>;
            case "string" -> value instanceof String;
            case "boolean" -> value instanceof Boolean;
            case "integer" -> isInteger(value);
            case "number" -> value instanceof Number;
            default -> true;
        };
    }

    static boolean isInteger(Object value) {
        return value instanceof Integer || value instanceof Long || value instanceof BigInteger
                || value instanceof Short || value instanceof Byte;
    }

    private static boolean same(Object expected, Object value) {
        if (expected instanceof Number a && value instanceof Number b) {
            return isInteger(b) && CanonicalJson.number(a).equals(CanonicalJson.number(b));
        }
        return expected != null && expected.equals(value);
    }
}
