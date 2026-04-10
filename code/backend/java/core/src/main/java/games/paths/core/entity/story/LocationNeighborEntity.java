package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * LocationNeighborEntity - JPA entity mapped to the "list_locations_neighbors" table.
 */
@Entity
@Table(name = "list_locations_neighbors")
public class LocationNeighborEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "id_location_from", nullable = false)
    private Integer idLocationFrom;

    @Column(name = "id_location_to", nullable = false)
    private Integer idLocationTo;

    @Column(nullable = false)
    private String direction;

    @Column(name = "flag_back", nullable = false)
    private Integer flagBack;

    @Column(name = "condition_registry_key")
    private String conditionRegistryKey;

    @Column(name = "condition_registry_value")
    private String conditionRegistryValue;

    @Column(name = "energy_cost")
    private Integer energyCost;

    @Column(name = "id_text_go")
    private Integer idTextGo;

    @Column(name = "id_text_back")
    private Integer idTextBack;

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
        if (flagBack == null) flagBack = 0;
        if (energyCost == null) energyCost = 0;
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

    public Integer getIdLocationFrom() { return idLocationFrom; }
    public void setIdLocationFrom(Integer idLocationFrom) { this.idLocationFrom = idLocationFrom; }

    public Integer getIdLocationTo() { return idLocationTo; }
    public void setIdLocationTo(Integer idLocationTo) { this.idLocationTo = idLocationTo; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public Integer getFlagBack() { return flagBack; }
    public void setFlagBack(Integer flagBack) { this.flagBack = flagBack; }

    public String getConditionRegistryKey() { return conditionRegistryKey; }
    public void setConditionRegistryKey(String conditionRegistryKey) { this.conditionRegistryKey = conditionRegistryKey; }

    public String getConditionRegistryValue() { return conditionRegistryValue; }
    public void setConditionRegistryValue(String conditionRegistryValue) { this.conditionRegistryValue = conditionRegistryValue; }

    public Integer getEnergyCost() { return energyCost; }
    public void setEnergyCost(Integer energyCost) { this.energyCost = energyCost; }

    public Integer getIdTextGo() { return idTextGo; }
    public void setIdTextGo(Integer idTextGo) { this.idTextGo = idTextGo; }

    public Integer getIdTextBack() { return idTextBack; }
    public void setIdTextBack(Integer idTextBack) { this.idTextBack = idTextBack; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
