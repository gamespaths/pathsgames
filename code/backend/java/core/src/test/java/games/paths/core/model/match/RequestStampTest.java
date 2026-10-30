package games.paths.core.model.match;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/** v1.7.0 one stamp per request, a fresh instant outside a request. */
class RequestStampTest {

    @Test
    void theSameStampUntilClosed() throws InterruptedException {
        RequestStamp.open();
        try {
            String first = RequestStamp.now();
            Thread.sleep(2);
            assertEquals(first, RequestStamp.now());
            assertNotNull(Instant.parse(first));
        } finally {
            RequestStamp.close();
        }
        String outside = RequestStamp.now();
        assertNotNull(Instant.parse(outside));
    }

    @Test
    void theIfMatchHeaderIsNormalized() {
        try {
            RequestStamp.open("W/\"v1\"");
            assertEquals("v1", RequestStamp.ifMatch());
            RequestStamp.open(" v2 ");
            assertEquals("v2", RequestStamp.ifMatch());
            RequestStamp.open("*");
            assertNull(RequestStamp.ifMatch());
            RequestStamp.open("\"\"");
            assertNull(RequestStamp.ifMatch());
            RequestStamp.open("\"");
            assertEquals("\"", RequestStamp.ifMatch());
            RequestStamp.open();
            assertNull(RequestStamp.ifMatch());
        } finally {
            RequestStamp.close();
        }
        assertNull(RequestStamp.ifMatch());
    }

    @Test
    void aClaimBecomesTheStampOfTheRequest() {
        try {
            RequestStamp.open();
            assertNull(RequestStamp.claimedVersion());
            RequestStamp.recordSeen("m", "s");
            assertEquals("s", RequestStamp.seenVersion("m"));
            assertNull(RequestStamp.seenVersion("x"));
            assertNull(RequestStamp.seenVersion(null));
            RequestStamp.recordClaim("m", "2026-10-22T10:00:00.000001Z");
            assertEquals("2026-10-22T10:00:00.000001Z", RequestStamp.now());
            assertEquals("2026-10-22T10:00:00.000001Z", RequestStamp.claimedVersion("m"));
            assertNull(RequestStamp.claimedVersion("other"));
            assertNull(RequestStamp.claimedVersion(null));
            assertEquals("2026-10-22T10:00:00.000001Z", RequestStamp.claimedVersion());
        } finally {
            RequestStamp.close();
        }
        RequestStamp.recordClaim("m", "v");
        RequestStamp.recordSeen("m", "v");
        assertNull(RequestStamp.claimedVersion("m"));
        assertNull(RequestStamp.seenVersion("m"));
        assertNull(RequestStamp.claimedVersion());
    }
}
