package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * LocationEntity - JPA entity mapped to the "list_locations" table.
 */
@Entity
@Table(name = "list_locations")
public class LocationEntity extends BaseStoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_text_narrative")
    private Integer idTextNarrative;

    @Column(name = "id_image")
    private Integer idImage;

    @Column(name = "is_safe", nullable = false)
    private Integer isSafe;

    @Column(name = "cost_energy_enter", nullable = false)
    private Integer costEnergyEnter;

    @Column(name = "counter_time")
    private Integer counterTime;

    @Column(name = "id_event_if_counter_zero")
    private Integer idEventIfCounterZero;

    @Column(name = "secure_param")
    private Integer secureParam;

    @Column(name = "id_event_if_character_start_time")
    private Integer idEventIfCharacterStartTime;

    @Column(name = "id_event_if_character_enter_first_time")
    private Integer idEventIfCharacterEnterFirstTime;

    @Column(name = "id_event_if_first_time")
    private Integer idEventIfFirstTime;

    @Column(name = "id_event_not_first_time")
    private Integer idEventNotFirstTime;

    @Column(name = "priority_automatic_event")
    private Integer priorityAutomaticEvent;

    @Column(name = "id_audio")
    private Integer idAudio;

    @Column(name = "max_characters")
    private Integer maxCharacters;

    @PrePersist
    protected void onCreate() {
        if (isSafe == null) isSafe = 0;
        if (costEnergyEnter == null) costEnergyEnter = 1;
        if (secureParam == null) secureParam = 0;
        if (priorityAutomaticEvent == null) priorityAutomaticEvent = 0;
        if (maxCharacters == null) maxCharacters = 100;
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }





    public Integer getIdTextNarrative() { return idTextNarrative; }
    public void setIdTextNarrative(Integer idTextNarrative) { this.idTextNarrative = idTextNarrative; }

    public Integer getIdImage() { return idImage; }
    public void setIdImage(Integer idImage) { this.idImage = idImage; }

    public Integer getIsSafe() { return isSafe; }
    public void setIsSafe(Integer isSafe) { this.isSafe = isSafe; }

    public Integer getCostEnergyEnter() { return costEnergyEnter; }
    public void setCostEnergyEnter(Integer costEnergyEnter) { this.costEnergyEnter = costEnergyEnter; }

    public Integer getCounterTime() { return counterTime; }
    public void setCounterTime(Integer counterTime) { this.counterTime = counterTime; }

    public Integer getIdEventIfCounterZero() { return idEventIfCounterZero; }
    public void setIdEventIfCounterZero(Integer idEventIfCounterZero) { this.idEventIfCounterZero = idEventIfCounterZero; }

    public Integer getSecureParam() { return secureParam; }
    public void setSecureParam(Integer secureParam) { this.secureParam = secureParam; }

    public Integer getIdEventIfCharacterStartTime() { return idEventIfCharacterStartTime; }
    public void setIdEventIfCharacterStartTime(Integer idEventIfCharacterStartTime) { this.idEventIfCharacterStartTime = idEventIfCharacterStartTime; }

    public Integer getIdEventIfCharacterEnterFirstTime() { return idEventIfCharacterEnterFirstTime; }
    public void setIdEventIfCharacterEnterFirstTime(Integer idEventIfCharacterEnterFirstTime) { this.idEventIfCharacterEnterFirstTime = idEventIfCharacterEnterFirstTime; }

    public Integer getIdEventIfFirstTime() { return idEventIfFirstTime; }
    public void setIdEventIfFirstTime(Integer idEventIfFirstTime) { this.idEventIfFirstTime = idEventIfFirstTime; }

    public Integer getIdEventNotFirstTime() { return idEventNotFirstTime; }
    public void setIdEventNotFirstTime(Integer idEventNotFirstTime) { this.idEventNotFirstTime = idEventNotFirstTime; }

    public Integer getPriorityAutomaticEvent() { return priorityAutomaticEvent; }
    public void setPriorityAutomaticEvent(Integer priorityAutomaticEvent) { this.priorityAutomaticEvent = priorityAutomaticEvent; }

    public Integer getIdAudio() { return idAudio; }
    public void setIdAudio(Integer idAudio) { this.idAudio = idAudio; }

    public Integer getMaxCharacters() { return maxCharacters; }
    public void setMaxCharacters(Integer maxCharacters) { this.maxCharacters = maxCharacters; }

}
