package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * LogItemUsageEntity - JPA entity mapped to "log_item_usage".
 * Schema defined by Flyway migration V0.10.9.
 *
 * <p>Step 34: one row per successful use-item. The {@code id} is part of the
 * composite primary key {@code (id, id_match)} but the table also carries a
 * {@code UNIQUE (id)} constraint, so ids are <b>globally</b> unique and must be
 * allocated from the table-wide maximum — never per match, the way
 * {@code gaming_inventory_items} does it. Same rule, same reason, as
 * {@link LogEventsEntity}.</p>
 *
 * <p>{@code effectsJson} and {@code timestamp} are both mapped as {@code String}:
 * V0.26.1 converted the timestamp columns to text and V0.34.0 did the same for
 * {@code effects_json} on PostgreSQL, precisely so that no dialect-specific
 * Hibernate type mapping is needed here.</p>
 */
@Entity
@Table(name = "log_item_usage")
@IdClass(LogItemUsageEntityId.class)
public class LogItemUsageEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_character_match", nullable = false)
    private Long idCharacterMatch;

    /** Story-scoped {@code list_items.id}; no JPA association, like every other id_item column. */
    @Column(name = "id_item", nullable = false)
    private Long idItem;

    /** How many units the usage consumed. Always 1 in V0: use-item discards the whole row. */
    @Column(name = "counter")
    private Integer counter;

    /** Serialised summary of what the usage changed. Plain text, see the class javadoc. */
    @Column(name = "effects_json")
    private String effectsJson;

    @Column(name = "timestamp")
    private String timestamp;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (counter == null) counter = 1;
        if (timestamp == null) timestamp = now;
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
    }

    @PreUpdate
    protected void onUpdate() {
        tsUpdate = java.time.Instant.now().toString();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Long getIdCharacterMatch() { return idCharacterMatch; }
    public void setIdCharacterMatch(Long idCharacterMatch) { this.idCharacterMatch = idCharacterMatch; }

    public Long getIdItem() { return idItem; }
    public void setIdItem(Long idItem) { this.idItem = idItem; }

    public Integer getCounter() { return counter; }
    public void setCounter(Integer counter) { this.counter = counter; }

    public String getEffectsJson() { return effectsJson; }
    public void setEffectsJson(String effectsJson) { this.effectsJson = effectsJson; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
