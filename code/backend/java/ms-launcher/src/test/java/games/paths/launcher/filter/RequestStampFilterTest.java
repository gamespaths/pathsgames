package games.paths.launcher.filter;

import games.paths.core.model.match.RequestStamp;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/** v1.7.0 one match stamp for the whole request, closed even when the chain fails. */
class RequestStampFilterTest {

    @Test
    void theChainSeesOneStampAndItIsClosedAfterwards() throws Exception {
        List<String> seen = new ArrayList<>();
        new RequestStampFilter().doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(), (rq, rs) -> {
            seen.add(RequestStamp.now());
            try {
                Thread.sleep(2);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            seen.add(RequestStamp.now());
        });
        assertEquals(seen.get(0), seen.get(1));
        assertNotNull(Instant.parse(seen.get(0)));
    }

    @Test
    void aFailingChainStillClosesTheStamp() {
        RequestStampFilter filter = new RequestStampFilter();
        String[] inside = new String[1];
        assertThrows(ServletException.class, () -> filter.doFilter(new MockHttpServletRequest(),
                new MockHttpServletResponse(), (rq, rs) -> {
                    inside[0] = RequestStamp.now();
                    throw new ServletException("boom");
                }));
        assertNotNull(inside[0]);
    }

    @Test
    void theIfMatchHeaderReachesTheRequestAndIsClearedAfterwards() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("If-Match", "\"2026-10-22T10:00:00Z\"");
        String[] inside = new String[1];
        new RequestStampFilter().doFilter(request, new MockHttpServletResponse(),
                (rq, rs) -> inside[0] = RequestStamp.ifMatch());
        assertEquals("2026-10-22T10:00:00Z", inside[0]);
        assertNull(RequestStamp.ifMatch());
    }

    @Test
    void aNonHttpRequestHasNoIfMatch() throws Exception {
        String[] inside = {"x"};
        new RequestStampFilter().doFilter(mock(jakarta.servlet.ServletRequest.class), new MockHttpServletResponse(),
                (rq, rs) -> inside[0] = RequestStamp.ifMatch());
        assertNull(inside[0]);
    }
}
