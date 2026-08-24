package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * LogEventsEntity - JPA entity mapped to "log_events".
 * Schema defined by Flyway migration V0.10.9.
 *
 * <p>Step 26: time-start recovery summaries and location counter-zero events are
 * appended here. The {@code id} is part of the composite primary key
 * {@code (id, id_match)} and is globally unique; it is assigned explicitly by the
 * adapter (SQLite does not auto-increment it).</p>
 */
@Entity
@Table(name = "log_events")
@IdClass(LogEventsEntityId.class)
public class LogEventsEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_character_match")
    private Long idCharacterMatch;

    @Column(name = "timestamp")
    private String timestamp;

    @Column(name = "id_event")
    private Long idEvent;

    @Column(name = "id_choise")
    private Long idChoise;

    @Column(name = "log_message")
    private String logMessage;

    /** Step 28.7 — clock value at the time of the event (null for pre-28.7 rows). */
    @Column(name = "clock")
    private Integer clock;

    /**
     * Step 33 (V0.33.0) — the location this row is about, for the rows the
     * location engine writes (counter-zero, automatic events). Structured, so the
     * frontend never has to parse it back out of {@code log_message}.
     */
    @Column(name = "id_location")
    private Long idLocation;

    /**
     * v0.35.3 - what the actor actually paid to open this event. Zero on every
     * row the engine writes for itself: chained, automatic and resolution rows.
     */
    @Column(name = "energy")
    private Integer energy;

    @Column(name = "food")
    private Integer food;

    @Column(name = "magic")
    private Integer magic;

    @Column(name = "coin")
    private Integer coin;

    /** v0.35.4 - what the event GAVE the actor, the counterpart of the spend above. */
    @Column(name = "energy_gain")
    private Integer energyGain;

    @Column(name = "food_gain")
    private Integer foodGain;

    @Column(name = "magic_gain")
    private Integer magicGain;

    @Column(name = "coin_gain")
    private Integer coinGain;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (timestamp == null) timestamp = now;
        if (energy == null) energy = 0;
        if (food == null) food = 0;
        if (magic == null) magic = 0;
        if (coin == null) coin = 0;
        if (energyGain == null) energyGain = 0;
        if (foodGain == null) foodGain = 0;
        if (magicGain == null) magicGain = 0;
        if (coinGain == null) coinGain = 0;
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

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public Long getIdEvent() { return idEvent; }
    public void setIdEvent(Long idEvent) { this.idEvent = idEvent; }

    public Long getIdChoise() { return idChoise; }
    public void setIdChoise(Long idChoise) { this.idChoise = idChoise; }

    public String getLogMessage() { return logMessage; }
    public void setLogMessage(String logMessage) { this.logMessage = logMessage; }

    public Integer getClock() { return clock; }
    public void setClock(Integer clock) { this.clock = clock; }

    public Long getIdLocation() { return idLocation; }
    public void setIdLocation(Long idLocation) { this.idLocation = idLocation; }

    public Integer getEnergy() { return energy; }
    public void setEnergy(Integer energy) { this.energy = energy; }

    public Integer getFood() { return food; }
    public void setFood(Integer food) { this.food = food; }

    public Integer getMagic() { return magic; }
    public void setMagic(Integer magic) { this.magic = magic; }

    public Integer getCoin() { return coin; }
    public void setCoin(Integer coin) { this.coin = coin; }

    public Integer getEnergyGain() { return energyGain; }
    public void setEnergyGain(Integer energyGain) { this.energyGain = energyGain; }

    public Integer getFoodGain() { return foodGain; }
    public void setFoodGain(Integer foodGain) { this.foodGain = foodGain; }

    public Integer getMagicGain() { return magicGain; }
    public void setMagicGain(Integer magicGain) { this.magicGain = magicGain; }

    public Integer getCoinGain() { return coinGain; }
    public void setCoinGain(Integer coinGain) { this.coinGain = coinGain; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
