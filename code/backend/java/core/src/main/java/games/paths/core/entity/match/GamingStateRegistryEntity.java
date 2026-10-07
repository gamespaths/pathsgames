package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * GamingStateRegistryEntity - JPA entity mapped to "gaming_state_registry".
 * Schema defined by Flyway migration V0.10.7.
 *
 * <p>Step 19: Holds the per-match key-value game state. At match creation,
 * one row per visible story key is inserted with the default value coming
 * from {@code list_keys.value}.</p>
 */
@Entity
@Table(name = "gaming_state_registry")
@IdClass(GamingStateRegistryEntityId.class)
public class GamingStateRegistryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(nullable = false)
    private String key;

    @Column(name = "string_value")
    private String stringValue;

    @Column(name = "int_value")
    private Integer intValue;

    @Column(name = "id_character")
    private Long idCharacter;

    @Column(name = "id_event")
    private Long idEvent;

    @Column(name = "id_choice")
    private Long idChoice;

    private Integer clock;

    @Column(name = "id_mission")
    private Long idMission;

    @Column(name = "id_mission_steps")
    private Long idMissionSteps;

    /** Step 36.1 - mirrors list_keys.multi_value so the partial unique indexes can see it. */
    @Column(name = "multi_value")
    private Integer multiValue;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
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

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getStringValue() { return stringValue; }
    public void setStringValue(String stringValue) { this.stringValue = stringValue; }

    public Integer getIntValue() { return intValue; }
    public void setIntValue(Integer intValue) { this.intValue = intValue; }

    public Long getIdCharacter() { return idCharacter; }
    public void setIdCharacter(Long idCharacter) { this.idCharacter = idCharacter; }

    public Long getIdEvent() { return idEvent; }
    public void setIdEvent(Long idEvent) { this.idEvent = idEvent; }

    public Long getIdChoice() { return idChoice; }
    public void setIdChoice(Long idChoice) { this.idChoice = idChoice; }

    public Integer getClock() { return clock; }
    public void setClock(Integer clock) { this.clock = clock; }

    public Long getIdMission() { return idMission; }
    public void setIdMission(Long idMission) { this.idMission = idMission; }

    public Long getIdMissionSteps() { return idMissionSteps; }
    public void setIdMissionSteps(Long idMissionSteps) { this.idMissionSteps = idMissionSteps; }

    public Integer getMultiValue() { return multiValue; }
    public void setMultiValue(Integer multiValue) { this.multiValue = multiValue; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
