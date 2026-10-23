package games.paths.adapters.rest.advice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import games.paths.core.model.match.RequestStamp;
import games.paths.core.model.match.StaleMatchException;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.AbstractJackson2HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * MatchVersionAdvice - v1.7.0 step 8: 409 STALE_MATCH for a refused claim, and the new matchVersion
 * added to every JSON answer of a request that claimed one (the 11 gameplay writes).
 */
@RestControllerAdvice
public class MatchVersionAdvice implements ResponseBodyAdvice<Object> {

    public static final String FIELD = "matchVersion";

    private final ObjectMapper mapper;

    public MatchVersionAdvice(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @ExceptionHandler(StaleMatchException.class)
    public ResponseEntity<Object> stale(StaleMatchException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", StaleMatchException.CODE);
        body.put("message", ex.getMessage());
        body.put(FIELD, ex.getCurrentVersion());
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return AbstractJackson2HttpMessageConverter.class.isAssignableFrom(converterType);
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType contentType,
                                  Class<? extends HttpMessageConverter<?>> converterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {
        String version = RequestStamp.claimedVersion();
        return version == null ? body : withVersion(body, version);
    }

    /** The body with matchVersion added; bodies that are not JSON objects or already carry it stay as they are. */
    Object withVersion(Object body, String version) {
        if (body == null) {
            return null;
        }
        if (body instanceof Map<?, ?> map) {
            if (map.containsKey(FIELD)) {
                return body;
            }
            Map<Object, Object> copy = new LinkedHashMap<>(map);
            copy.put(FIELD, version);
            return copy;
        }
        JsonNode node = mapper.valueToTree(body);
        if (node instanceof ObjectNode obj && !obj.has(FIELD)) {
            obj.put(FIELD, version);
            return obj;
        }
        return body;
    }
}
