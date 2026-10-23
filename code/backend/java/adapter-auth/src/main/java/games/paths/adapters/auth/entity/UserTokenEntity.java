package games.paths.adapters.auth.entity;

import jakarta.persistence.*;

/**
 * UserTokenEntity - JPA entity mapped to the "users_tokens" table.
 * Schema defined by Flyway migration V0.10.1.
 * Stores refresh tokens associated with users.
 */
@Entity
@Table(name = "users_tokens")
public class UserTokenEntity extends BaseAuthEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_user", nullable = false)
    private Long idUser;

    @Column(name = "refresh_token", nullable = false)
    private String refreshToken;

    @Column(name = "expires_at", nullable = false)
    private String expiresAt;

    @Column(nullable = false)
    private Boolean revoked = false;

    // v1.2.0 set when a refresh rotated the token: starts the grace window
    @Column(name = "ts_rotated")
    private String tsRotated;

    // v1.7.0 ROTATED, LOGOUT, LOGOUT_ALL, LIMIT or ADMIN; null while the token is active
    @Column(name = "revoked_reason")
    private String revokedReason;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (getUuid() == null) setUuid(java.util.UUID.randomUUID().toString());
        if (getTsInsert() == null) setTsInsert(now);
        if (getTsUpdate() == null) setTsUpdate(now);
    }

    // === Getters & Setters ===

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getIdUser() {
        return idUser;
    }

    public void setIdUser(Long idUser) {
        this.idUser = idUser;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(String expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Boolean getRevoked() {
        return revoked;
    }

    public void setRevoked(Boolean revoked) {
        this.revoked = revoked;
    }

    public String getTsRotated() {
        return tsRotated;
    }

    public void setTsRotated(String tsRotated) {
        this.tsRotated = tsRotated;
    }

    public String getRevokedReason() {
        return revokedReason;
    }

    public void setRevokedReason(String revokedReason) {
        this.revokedReason = revokedReason;
    }
}
