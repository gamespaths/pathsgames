package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * LogItemUsageEntity - JPA entity mapped to "log_item_usage".
 * Schema defined by Flyway migration V0.10.9.
 *
 * <p>Step 34: one row per successful use-item. v0.35.4 widens it to one row per
 * item ACTION - taking, using, dropping - so {@code action} tells them apart.
 * The {@code id} is part of the composite primary key {@code (id, id_match)}
 * but the table also carries a
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

    /** v0.35.4 - ADD, USE, DROP or REMOVE. Rows written before it are all USE. */
    @Column(name = "action")
    private String action;

    /** v0.35.4 - the event whose effect moved the item; null when the player acted directly. */
    @Column(name = "id_event")
    private Long idEvent;

    /** How many units the action moved. */
    @Column(name = "counter")
    private Integer counter;

    /** v0.35.4 - signed resource deltas the action produced; zero on ADD and DROP. */
    @Column(name = "energy")
    private Integer energy;

    @Column(name = "food")
    private Integer food;

    @Column(name = "magic")
    private Integer magic;

    @Column(name = "coin")
    private Integer coin;

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
        if (action == null) action = "USE";
        if (energy == null) energy = 0;
        if (food == null) food = 0;
        if (magic == null) magic = 0;
        if (coin == null) coin = 0;
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

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public Long getIdEvent() { return idEvent; }
    public void setIdEvent(Long idEvent) { this.idEvent = idEvent; }

    public Integer getCounter() { return counter; }
    public void setCounter(Integer counter) { this.counter = counter; }

    public Integer getEnergy() { return energy; }
    public void setEnergy(Integer energy) { this.energy = energy; }

    public Integer getFood() { return food; }
    public void setFood(Integer food) { this.food = food; }

    public Integer getMagic() { return magic; }
    public void setMagic(Integer magic) { this.magic = magic; }

    public Integer getCoin() { return coin; }
    public void setCoin(Integer coin) { this.coin = coin; }

    public String getEffectsJson() { return effectsJson; }
    public void setEffectsJson(String effectsJson) { this.effectsJson = effectsJson; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
