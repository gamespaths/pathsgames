package games.paths.core.model.match.export;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CanonicalJson - v0.41.4 Step 41 H: the canonical text of the match export (keys by code point, no
 * whitespace, null keys dropped, minimal escapes, RFC 8785 for integers), same output as python/aws.
 */
public final class CanonicalJson {

    private static final ObjectMapper READER = JsonMapper.builder()
            .enable(DeserializationFeature.USE_BIG_INTEGER_FOR_INTS)
            .build();

    private CanonicalJson() {
    }

    /** The canonical text of a value built from maps, lists, strings, numbers and booleans. */
    public static String write(Object value) {
        StringBuilder out = new StringBuilder();
        append(out, value);
        return out.toString();
    }

    /** SHA-256 hex of the canonical text. */
    public static String sha256(Object value) {
        return sha256Hex(write(value));
    }

    public static String sha256Hex(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    /** UTF-8 size of the canonical text. */
    public static long size(Object value) {
        return write(value).getBytes(StandardCharsets.UTF_8).length;
    }

    /** Parses JSON text into maps/lists with exact integers; null when it is not JSON. */
    public static Object parse(String json) {
        if (json == null) {
            return null;
        }
        try {
            return normalize(READER.readValue(json, Object.class));
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    /** Integral BigInteger values back to Long/Integer when they fit, so maps compare naturally. */
    @SuppressWarnings("unchecked")
    static Object normalize(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            map.forEach((k, v) -> out.put(String.valueOf(k), normalize(v)));
            return out;
        }
        if (value instanceof List<?> list) {
            List<Object> out = new ArrayList<>(list.size());
            list.forEach(v -> out.add(normalize(v)));
            return out;
        }
        if (value instanceof BigInteger big && big.bitLength() < 64) {
            return big.longValue();
        }
        return value;
    }

    private static void append(StringBuilder out, Object value) {
        if (value == null) {
            out.append("null");
        } else if (value instanceof Map<?, ?> map) {
            appendObject(out, map);
        } else if (value instanceof Collection<?> list) {
            out.append('[');
            boolean first = true;
            for (Object item : list) {
                if (!first) {
                    out.append(',');
                }
                first = false;
                append(out, item);
            }
            out.append(']');
        } else if (value instanceof Object[] array) {
            append(out, java.util.Arrays.asList(array));
        } else if (value instanceof String s) {
            appendString(out, s);
        } else if (value instanceof Boolean b) {
            out.append(b ? "true" : "false");
        } else if (value instanceof Number n) {
            out.append(number(n));
        } else {
            appendString(out, value.toString());
        }
    }

    private static void appendObject(StringBuilder out, Map<?, ?> map) {
        List<String> keys = new ArrayList<>();
        map.forEach((k, v) -> {
            if (v != null) {
                keys.add(String.valueOf(k));
            }
        });
        keys.sort(CanonicalJson::compareCodePoints);
        out.append('{');
        boolean first = true;
        for (String key : keys) {
            if (!first) {
                out.append(',');
            }
            first = false;
            appendString(out, key);
            out.append(':');
            append(out, map.get(key));
        }
        out.append('}');
    }

    /** Code point order, as Python sorts str keys (String.compareTo is UTF-16 order). */
    public static int compareCodePoints(String a, String b) {
        int i = 0;
        int j = 0;
        while (i < a.length() && j < b.length()) {
            int ca = a.codePointAt(i);
            int cb = b.codePointAt(j);
            if (ca != cb) {
                return Integer.compare(ca, cb);
            }
            i += Character.charCount(ca);
            j += Character.charCount(cb);
        }
        return Integer.compare(a.length() - i, b.length() - j);
    }

    static String number(Number n) {
        if (n instanceof Double || n instanceof Float) {
            return pythonFloat(n.doubleValue());
        }
        if (n instanceof BigDecimal big) {
            return pythonFloat(big.doubleValue());
        }
        return n.toString();
    }

    /** A float as Python's repr writes it (json.dumps): shortest digits, exponent outside [-4, 16). */
    static String pythonFloat(double d) {
        if (Double.isNaN(d) || Double.isInfinite(d)) {
            return "null";
        }
        if (d == 0) {
            return (1 / d < 0) ? "-0.0" : "0.0";
        }
        BigDecimal exact = new BigDecimal(Double.toString(d)).stripTrailingZeros();
        int exponent = exact.precision() - exact.scale() - 1;
        if (exponent >= -4 && exponent < 16) {
            String plain = exact.toPlainString();
            return plain.contains(".") ? plain : plain + ".0";
        }
        String digits = exact.unscaledValue().abs().toString();
        String mantissa = digits.length() == 1 ? digits : digits.charAt(0) + "." + digits.substring(1);
        String sign = exact.signum() < 0 ? "-" : "";
        return sign + mantissa + "e" + (exponent < 0 ? "-" : "+") + String.format("%02d", Math.abs(exponent));
    }

    static void appendString(StringBuilder out, String s) {
        out.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        out.append('"');
    }
}
