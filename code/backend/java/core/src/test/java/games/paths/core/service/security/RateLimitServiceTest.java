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
    @DisplayName("v1.10.0 without trusted proxies the client is the socket peer, X-Forwarded-For ignored")
    void clientIp() {
        assertEquals("127.0.0.1", RateLimitService.clientIp("9.9.9.9, 10.0.0.1", "127.0.0.1"));
        assertEquals("127.0.0.1", RateLimitService.clientIp(null, " 127.0.0.1 "));
        assertEquals("", RateLimitService.clientIp("9.9.9.9", null));
        RateLimitService behindProxy = new RateLimitService(60, Clock.systemUTC(), TrustedProxies.parse("10.0.0.0/8"));
        assertEquals("9.9.9.9", behindProxy.clientIpOf("1.2.3.4, 9.9.9.9, 10.0.0.2", "10.0.0.1"));
        assertEquals("8.8.8.8", behindProxy.clientIpOf("9.9.9.9", "8.8.8.8"));
        assertEquals("1.1.1.1", new RateLimitService(60, Clock.systemUTC(), null).clientIpOf("9.9.9.9", "1.1.1.1"));
    }

    @Test
    @DisplayName("v1.10.0 a CIDR range compares, hashes and prints the address bytes, not the array reference")
    void rangeUsesTheArrayContent() {
        TrustedProxies.Range a = new TrustedProxies.Range(new byte[] {10, 0, 0, 0}, 8);
        TrustedProxies.Range b = new TrustedProxies.Range(new byte[] {10, 0, 0, 0}, 8);
        TrustedProxies.Range same = a;
        assertEquals(a, same);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, new TrustedProxies.Range(new byte[] {10, 0, 0, 0}, 16));
        assertNotEquals(a, new TrustedProxies.Range(new byte[] {11, 0, 0, 0}, 8));
        assertNotEquals(a, null);
        Object text = "10.0.0.0/8";
        assertNotEquals(a, text);
        assertEquals("Range{network=[10, 0, 0, 0], bits=8}", a.toString());
    }

    @Test
    @DisplayName("v1.10.0 trusted proxies: CIDRs and single addresses, IPv4 and IPv6, junk skipped, no DNS")
    void trustedProxies() {
        TrustedProxies p = TrustedProxies.parse(" 10.0.0.0/8 , 192.168.1.7, fd00::/8, junk, 1.2.3.4/33, 1.2.3.4/x,"
                + " 300.1.1.1, host.example.com, ");
        assertFalse(p.isEmpty());
        assertTrue(p.contains("10.255.0.1"));
        assertTrue(p.contains("192.168.1.7"));
        assertFalse(p.contains("192.168.1.8"));
        assertTrue(p.contains("fd12::1"));
        assertTrue(p.contains("[fd12::1]"));
        assertFalse(p.contains("fe80::1"));
        assertFalse(p.contains("10.0.0.1x"));
        assertFalse(p.contains("1.2.3.4"));
        assertFalse(p.contains(null));
        assertFalse(p.contains("zz:zz"));
        assertTrue(TrustedProxies.parse(null).isEmpty());
        assertTrue(TrustedProxies.parse(" , junk").isEmpty());
        assertSame(TrustedProxies.none(), TrustedProxies.parse(""));
        assertTrue(TrustedProxies.parse("172.16.0.0/12").contains("172.31.255.255"));
        assertFalse(TrustedProxies.parse("172.16.0.0/12").contains("172.32.0.0"));
        assertTrue(TrustedProxies.parse("0.0.0.0/0").contains("8.8.8.8"));
        assertTrue(TrustedProxies.parse("1.2.3.4/-1, 1:2:3/8").isEmpty());
        assertFalse(p.contains("1:2:3"));
        // every hop a proxy: the peer; a blank list behind a proxy: the peer
        assertEquals("10.0.0.1", p.clientIp("10.0.0.3, 10.0.0.2", "10.0.0.1"));
        assertEquals("10.0.0.1", p.clientIp(" , ", "10.0.0.1"));
        assertEquals("10.0.0.1", p.clientIp(null, "10.0.0.1"));
        assertEquals("", p.clientIp("9.9.9.9", null));
    }

    @Test
    @DisplayName("v0.41.0 - a counter keeps its own window: 24 h survives the 1 h sweep")
    void perCounterWindowSurvivesTheSweep() {
        TestClock clock = new TestClock();
        RateLimitService svc = new RateLimitService(3600, clock);
        assertTrue(svc.tryAcquire("match-guest", "user-1", 1, 86400).allowed());
        RateLimitService.Verdict refused = svc.tryAcquire("match-guest", "user-1", 1, 86400);
        assertFalse(refused.allowed());
        assertEquals(86400, refused.retryAfterSeconds());
        // Two hours and a full sweep later the daily window is still shut.
        clock.now += 7_200_000L;
        for (int i = 0; i < 2100; i++) {
            svc.tryAcquire("match", "ip-" + i, 1);
        }
        RateLimitService.Verdict still = svc.tryAcquire("match-guest", "user-1", 1, 86400);
        assertFalse(still.allowed());
        assertEquals(79200, still.retryAfterSeconds());
        clock.now += 79_200_000L;
        assertTrue(svc.tryAcquire("match-guest", "user-1", 1, 86400).allowed());
    }

    @Test
    @DisplayName("v0.41.0 - a non-positive per-counter window is clamped to one second")
    void perCounterWindowClamped() {
        TestClock clock = new TestClock();
        RateLimitService svc = new RateLimitService(3600, clock);
        svc.tryAcquire("match-guest", "u", 1, 0);
        assertFalse(svc.tryAcquire("match-guest", "u", 1, 0).allowed());
        clock.now += 1_000;
        assertTrue(svc.tryAcquire("match-guest", "u", 1, -5).allowed());
        assertTrue(svc.tryAcquire("match-guest", "u", 0, 10).allowed());
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
