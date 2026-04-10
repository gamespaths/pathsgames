package games.paths.adapters.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PreUpdate;

/**
 * BaseAuthEntity - Base class for auth-module JPA entities.
 *
 * <p>Centralises the three fields shared by every auth entity:</p>
 * <ul>
 *   <li>{@code uuid}     — opaque public identifier</li>
 *   <li>{@code tsInsert} — ISO-8601 creation timestamp</li>
 *   <li>{@code tsUpdate} — ISO-8601 last-update timestamp</li>
 * </ul>
 *
 * <p>The {@link #onUpdate()} callback refreshes {@code tsUpdate}.
 * Subclasses must provide their own {@code @PrePersist} method to
 * initialise {@code tsInsert}, {@code tsUpdate} and any entity-specific
 * defaults (e.g. {@code uuid} auto-generation or registration timestamp).</p>
 */
@MappedSuperclass
public abstract class BaseAuthEntity {

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PreUpdate
    protected void onUpdate() {
        tsUpdate = java.time.Instant.now().toString();
    }

    // ─── Getters / Setters ──────────────────────────────────────────────────────

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getTsInsert() { return tsInsert; }
    protected void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    protected void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
