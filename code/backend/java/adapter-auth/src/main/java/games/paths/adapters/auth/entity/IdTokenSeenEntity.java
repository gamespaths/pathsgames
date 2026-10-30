package games.paths.adapters.auth.entity;

import jakarta.persistence.*;

/**
 * IdTokenSeenEntity - v1.2.0 "auth_id_token_seen": the SHA-256 of a used Google ID token, kept
 * until its exp so the same token is refused a second time.
 */
@Entity
@Table(name = "auth_id_token_seen")
public class IdTokenSeenEntity {

    @Id
    @Column(name = "token_hash")
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private String expiresAt;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    public IdTokenSeenEntity() {
    }

    public IdTokenSeenEntity(String tokenHash, String expiresAt) {
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.tsInsert = java.time.Instant.now().toString();
    }

    public String getTokenHash() { return tokenHash; }
    public String getExpiresAt() { return expiresAt; }
    public String getTsInsert() { return tsInsert; }
}
