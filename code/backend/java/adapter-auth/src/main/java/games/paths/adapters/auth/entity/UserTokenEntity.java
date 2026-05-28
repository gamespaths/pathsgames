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
}
