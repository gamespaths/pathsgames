package games.paths.core.entity.match;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;

/**
 * Shared mapped superclass for the match-scoped gaming entities (Step 21):
 * the {@code (id, id_match)} composite key, the unique {@code uuid} and the
 * {@code ts_insert} / {@code ts_update} audit timestamps, plus the helpers that
 * assign the uuid and maintain the timestamps.
 *
 * <p>v0.20.9 — extracted from the per-entity classes to remove the duplicated
 * key/audit boilerplate flagged by SonarQube. The lifecycle callbacks stay on
 * each entity (single {@code @PrePersist}/{@code @PreUpdate} per class) and
 * delegate the shared part to {@link #applyUuidAndTimestamps()} /
 * {@link #applyUpdateTimestamp()}.</p>
 */
@MappedSuperclass
public abstract class AbstractMatchScopedEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    /** Assigns the uuid (if absent) and the insert/update timestamps. */
    protected void applyUuidAndTimestamps() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
    }

    /** Refreshes the update timestamp. */
    protected void applyUpdateTimestamp() {
        tsUpdate = java.time.Instant.now().toString();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
