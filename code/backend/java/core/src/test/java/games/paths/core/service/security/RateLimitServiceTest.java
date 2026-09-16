package games.paths.core.service.security;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Step 41 — the fixed-window counter behind the guest and match buckets. */
class RateLimitServiceTest {

    /** A clock the test moves by hand. */
    private static final class TestClock extends Clock {
        long now = 1_000_000L;
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return Instant.ofEpochMilli(now); }
    }

    @Test
    @DisplayName("The limit-th attempt passes and the next one is refused")
    void limitIsInclusive() {
        RateLimitService svc = new RateLimitService(60, new TestClock());
        for (int i = 0; i < 3; i++) {
            RateLimitService.Verdict v = svc.tryAcquire("guest", "1.2.3.4", 3);
            assertTrue(v.allowed(), "attempt " + (i + 1) + " must pass");
            assertEquals(2 - i, v.remaining());
        }
        RateLimitService.Verdict refused = svc.tryAcquire("guest", "1.2.3.4", 3);
        assertFalse(refused.allowed());
        assertEquals(0, refused.remaining());
        assertEquals(3, refused.limit());
        assertTrue(refused.retryAfterSeconds() >= 1 && refused.retryAfterSeconds() <= 60);
    }

    @Test
    @DisplayName("Buckets and keys are independent")
    void bucketsAndKeysAreIndependent() {
        RateLimitService svc = new RateLimitService(60, new TestClock());
        svc.tryAcquire("guest", "1.2.3.4", 1);
        assertFalse(svc.tryAcquire("guest", "1.2.3.4", 1).allowed());
        assertTrue(svc.tryAcquire("match", "1.2.3.4", 1).allowed(), "another bucket, same ip");
        assertTrue(svc.tryAcquire("guest", "5.6.7.8", 1).allowed(), "same bucket, another ip");
    }

    @Test
    @DisplayName("The window reopens once it has elapsed, and retry-after counts down to it")
    void windowReopens() {
        TestClock clock = new TestClock();
        RateLimitService svc = new RateLimitService(10, clock);
        svc.tryAcquire("guest", "ip", 1);
        clock.now += 4_000;
        RateLimitService.Verdict refused = svc.tryAcquire("guest", "ip", 1);
        assertFalse(refused.allowed());
        assertEquals(6, refused.retryAfterSeconds());
        clock.now += 6_000;
        assertTrue(svc.tryAcquire("guest", "ip", 1).allowed());
    }

    @Test
    @DisplayName("A refused attempt still counts, so hammering keeps the window shut")
    void refusedAttemptsCount() {
        TestClock clock = new TestClock();
        RateLimitService svc = new RateLimitService(10, clock);
        for (int i = 0; i < 5; i++) {
            svc.tryAcquire("guest", "ip", 2);
        }
        assertEquals(0, svc.tryAcquire("guest", "ip", 2).remaining());
        svc.reset();
        assertTrue(svc.tryAcquire("guest", "ip", 2).allowed());
    }

    @Test
    @DisplayName("A zero limit or a blank key is never limited")
    void disabledOrAnonymous() {
        RateLimitService svc = new RateLimitService(60, new TestClock());
        for (int i = 0; i < 50; i++) {
            assertTrue(svc.tryAcquire("guest", "ip", 0).allowed());
            assertTrue(svc.tryAcquire("guest", "ip", -1).allowed());
            assertTrue(svc.tryAcquire("guest", " ", 1).allowed());
            assertTrue(svc.tryAcquire("guest", null, 1).allowed());
        }
        assertEquals(Integer.MAX_VALUE, RateLimitService.Verdict.unlimited().remaining());
    }

    @Test
    @DisplayName("Stale windows are swept away without changing any verdict")
    void sweepKeepsWorking() {
        TestClock clock = new TestClock();
        RateLimitService svc = new RateLimitService(1, clock);
        for (int i = 0; i < 2100; i++) {
            svc.tryAcquire("guest", "ip-" + i, 1);
            clock.now += 1;
        }
        clock.now += 5_000;
        assertTrue(svc.tryAcquire("guest", "ip-0", 1).allowed());
    }

    @Test
    @DisplayName("The client address is the first forwarded hop, else the socket peer")
    void clientIp() {
        assertEquals("9.9.9.9", RateLimitService.clientIp("9.9.9.9, 10.0.0.1", "127.0.0.1"));
        assertEquals("9.9.9.9", RateLimitService.clientIp(" 9.9.9.9 ", "127.0.0.1"));
        assertEquals("127.0.0.1", RateLimitService.clientIp(null, "127.0.0.1"));
        assertEquals("127.0.0.1", RateLimitService.clientIp("  ", " 127.0.0.1 "));
        assertEquals("127.0.0.1", RateLimitService.clientIp(" , 10.0.0.1", "127.0.0.1"));
        assertEquals("", RateLimitService.clientIp(null, null));
    }

    @Test
    @DisplayName("A non-positive window is clamped to one second")
    void windowClamped() {
        TestClock clock = new TestClock();
        RateLimitService svc = new RateLimitService(0, clock);
        svc.tryAcquire("guest", "ip", 1);
        assertFalse(svc.tryAcquire("guest", "ip", 1).allowed());
        clock.now += 1_000;
        assertTrue(svc.tryAcquire("guest", "ip", 1).allowed());
        assertNotNull(new RateLimitService(60));
    }
}
