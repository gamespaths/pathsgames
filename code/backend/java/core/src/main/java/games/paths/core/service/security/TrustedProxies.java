package games.paths.core.service.security;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * TrustedProxies - v1.10.0 the proxies (TRUSTED_PROXIES, comma-separated CIDRs) whose X-Forwarded-For
 * is believed; empty, the default, means the socket peer is the client and the header is ignored.
 */
public final class TrustedProxies {

    private static final Pattern IPV4 = Pattern.compile("\\d{1,3}(\\.\\d{1,3}){3}");
    private static final Pattern IPV6 = Pattern.compile("[0-9a-fA-F:.]*:[0-9a-fA-F:.]*");

    private record Range(byte[] network, int bits) {
        boolean contains(byte[] ip) {
            if (ip.length != network.length) {
                return false;
            }
            int full = bits / 8;
            for (int i = 0; i < full; i++) {
                if (ip[i] != network[i]) {
                    return false;
                }
            }
            int rest = bits % 8;
            int mask = (0xFF << (8 - rest)) & 0xFF;
            return rest == 0 || (ip[full] & mask) == (network[full] & mask);
        }
    }

    private static final TrustedProxies NONE = new TrustedProxies(List.of());

    private final List<Range> ranges;

    private TrustedProxies(List<Range> ranges) {
        this.ranges = ranges;
    }

    public static TrustedProxies none() {
        return NONE;
    }

    /** Comma-separated CIDRs or single addresses; an unreadable entry is skipped. */
    public static TrustedProxies parse(String spec) {
        List<Range> out = new ArrayList<>();
        for (String raw : spec == null ? new String[0] : spec.split(",")) {
            String entry = raw.trim();
            int slash = entry.indexOf('/');
            byte[] network = bytes(slash < 0 ? entry : entry.substring(0, slash));
            if (network == null) {
                continue;
            }
            int bits = network.length * 8;
            if (slash >= 0) {
                try {
                    bits = Integer.parseInt(entry.substring(slash + 1).trim());
                } catch (NumberFormatException unreadable) {
                    continue;
                }
            }
            if (bits >= 0 && bits <= network.length * 8) {
                out.add(new Range(network, bits));
            }
        }
        return out.isEmpty() ? NONE : new TrustedProxies(List.copyOf(out));
    }

    public boolean isEmpty() {
        return ranges.isEmpty();
    }

    public boolean contains(String address) {
        byte[] ip = bytes(address);
        return ip != null && ranges.stream().anyMatch(r -> r.contains(ip));
    }

    /** The socket peer, or behind a trusted proxy the right-most X-Forwarded-For hop that is not a proxy. */
    public String clientIp(String forwardedFor, String remoteAddr) {
        String peer = remoteAddr == null ? "" : remoteAddr.trim();
        if (forwardedFor == null || forwardedFor.isBlank() || !contains(peer)) {
            return peer;
        }
        String[] hops = forwardedFor.split(",");
        for (int i = hops.length - 1; i >= 0; i--) {
            String hop = hops[i].trim();
            if (!hop.isEmpty() && !contains(hop)) {
                return hop;
            }
        }
        return peer;
    }

    /** The bytes of a literal IPv4/IPv6 address, null otherwise (a host name is never resolved). */
    static byte[] bytes(String address) {
        String a = address == null ? "" : address.trim();
        if (a.startsWith("[") && a.endsWith("]")) {
            a = a.substring(1, a.length() - 1);
        }
        if (IPV4.matcher(a).matches()) {
            String[] parts = a.split("\\.");
            byte[] out = new byte[4];
            for (int i = 0; i < 4; i++) {
                int octet = Integer.parseInt(parts[i]);
                if (octet > 255) {
                    return null;
                }
                out[i] = (byte) octet;
            }
            return out;
        }
        if (!IPV6.matcher(a).matches()) {
            return null;
        }
        try {
            // brackets: a literal or UnknownHostException, never a DNS lookup
            return InetAddress.getByName("[" + a + "]").getAddress();
        } catch (UnknownHostException unreadable) {
            return null;
        }
    }
}
