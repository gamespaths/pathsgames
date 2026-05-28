package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * GamingMatchEntity - JPA entity mapped to the "gaming_match" table.
 * Schema defined by Flyway migration V0.10.6.
 *
 * <p>Step 19: Single-player match creation. Represents one playable match,
 * created by a user against a story+difficulty pair. Status lifecycle:
 * CREATED → RUNNING → PAUSED → ENDED → GAMEOVER.</p>
 */
@Entity
@Table(name = "gaming_match")
public class GamingMatchEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    private String name;

    @Column(name = "id_difficulty", nullable = false)
    private Long idDifficulty;

    @Column(name = "exp_cost", nullable = false)
    private Integer expCost;

    @Column(nullable = false)
    private String status;

    @Column(name = "current_clock", nullable = false)
    private Integer currentClock;

    @Column(name = "id_current_weather")
    private Long idCurrentWeather;

    @Column(name = "id_user_creator", nullable = false)
    private Long idUserCreator;

    @Column(name = "timestamp_start")
    private String timestampStart;

    @Column(name = "timestamp_lock_expiration")
    private String timestampLockExpiration;

    @Column(name = "timestamp_gameover")
    private String timestampGameover;

    @Column(name = "timestamp_end")
    private String timestampEnd;

    @Column(name = "id_character_current_turn")
    private Long idCharacterCurrentTurn;

    @Column(name = "secure_location_param")
    private Integer secureLocationParam;

    @Column(name = "counter_consecutive_pass", nullable = false)
    private Integer counterConsecutivePass;

    /** Step 0.19.9 — player loadout chosen at match creation. */
    @Column(name = "single_player", nullable = false)
    private Integer singlePlayer;

    @Column(name = "character_template_uuid")
    private String characterTemplateUuid;

    @Column(name = "class_uuid")
    private String classUuid;

    /** Comma-separated list of trait uuids; see {@code MatchTraitCodec}. */
    @Column(name = "trait_uuids")
    private String traitUuids;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (status == null) status = "CREATED";
        if (currentClock == null) currentClock = 0;
        if (expCost == null) expCost = 5;
        if (secureLocationParam == null) secureLocationParam = 0;
        if (counterConsecutivePass == null) counterConsecutivePass = 0;
        if (singlePlayer == null) singlePlayer = 1;
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
    }

    @PreUpdate
    protected void onUpdate() {
        tsUpdate = java.time.Instant.now().toString();
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Long getIdStory() { return idStory; }
    public void setIdStory(Long idStory) { this.idStory = idStory; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getIdDifficulty() { return idDifficulty; }
    public void setIdDifficulty(Long idDifficulty) { this.idDifficulty = idDifficulty; }

    public Integer getExpCost() { return expCost; }
    public void setExpCost(Integer expCost) { this.expCost = expCost; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getCurrentClock() { return currentClock; }
    public void setCurrentClock(Integer currentClock) { this.currentClock = currentClock; }

    public Long getIdCurrentWeather() { return idCurrentWeather; }
    public void setIdCurrentWeather(Long idCurrentWeather) { this.idCurrentWeather = idCurrentWeather; }

    public Long getIdUserCreator() { return idUserCreator; }
    public void setIdUserCreator(Long idUserCreator) { this.idUserCreator = idUserCreator; }

    public String getTimestampStart() { return timestampStart; }
    public void setTimestampStart(String timestampStart) { this.timestampStart = timestampStart; }

    public String getTimestampLockExpiration() { return timestampLockExpiration; }
    public void setTimestampLockExpiration(String timestampLockExpiration) { this.timestampLockExpiration = timestampLockExpiration; }

    public String getTimestampGameover() { return timestampGameover; }
    public void setTimestampGameover(String timestampGameover) { this.timestampGameover = timestampGameover; }

    public String getTimestampEnd() { return timestampEnd; }
    public void setTimestampEnd(String timestampEnd) { this.timestampEnd = timestampEnd; }

    public Long getIdCharacterCurrentTurn() { return idCharacterCurrentTurn; }
    public void setIdCharacterCurrentTurn(Long idCharacterCurrentTurn) { this.idCharacterCurrentTurn = idCharacterCurrentTurn; }

    public Integer getSecureLocationParam() { return secureLocationParam; }
    public void setSecureLocationParam(Integer secureLocationParam) { this.secureLocationParam = secureLocationParam; }

    public Integer getCounterConsecutivePass() { return counterConsecutivePass; }
    public void setCounterConsecutivePass(Integer counterConsecutivePass) { this.counterConsecutivePass = counterConsecutivePass; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }

    public Integer getSinglePlayer() { return singlePlayer; }
    public void setSinglePlayer(Integer singlePlayer) { this.singlePlayer = singlePlayer; }

    public String getCharacterTemplateUuid() { return characterTemplateUuid; }
    public void setCharacterTemplateUuid(String characterTemplateUuid) {
        this.characterTemplateUuid = characterTemplateUuid;
    }

    public String getClassUuid() { return classUuid; }
    public void setClassUuid(String classUuid) { this.classUuid = classUuid; }

    public String getTraitUuids() { return traitUuids; }
    public void setTraitUuids(String traitUuids) { this.traitUuids = traitUuids; }
}
