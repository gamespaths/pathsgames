package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ChoiceEntity - JPA entity mapped to the "list_choices" table.
 */
@Entity
@Table(name = "list_choices")
public class ChoiceEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "id_event")
    private Integer idEvent;

    @Column(name = "id_location")
    private Integer idLocation;

    private Integer priority;

    @Column(name = "id_text_name")
    private Integer idTextName;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

    @Column(name = "id_text_narrative")
    private Integer idTextNarrative;

    @Column(name = "id_event_torun")
    private Integer idEventTorun;

    @Column(name = "limit_sad")
    private Integer limitSad;

    @Column(name = "limit_dex")
    private Integer limitDex;

    @Column(name = "limit_int")
    private Integer limitInt;

    @Column(name = "limit_cos")
    private Integer limitCos;

    @Column(name = "otherwise_flag", nullable = false)
    private Integer otherwiseFlag;

    @Column(name = "is_progress", nullable = false)
    private Integer isProgress;

    @Column(name = "logic_operator")
    private String logicOperator;

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
        if (priority == null) priority = 0;
        if (otherwiseFlag == null) otherwiseFlag = 0;
        if (isProgress == null) isProgress = 0;
        if (logicOperator == null) logicOperator = "AND";
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

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public Long getIdStory() { return idStory; }
    public void setIdStory(Long idStory) { this.idStory = idStory; }

    public Integer getIdEvent() { return idEvent; }
    public void setIdEvent(Integer idEvent) { this.idEvent = idEvent; }

    public Integer getIdLocation() { return idLocation; }
    public void setIdLocation(Integer idLocation) { this.idLocation = idLocation; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

    public Integer getIdTextNarrative() { return idTextNarrative; }
    public void setIdTextNarrative(Integer idTextNarrative) { this.idTextNarrative = idTextNarrative; }

    public Integer getIdEventTorun() { return idEventTorun; }
    public void setIdEventTorun(Integer idEventTorun) { this.idEventTorun = idEventTorun; }

    public Integer getLimitSad() { return limitSad; }
    public void setLimitSad(Integer limitSad) { this.limitSad = limitSad; }

    public Integer getLimitDex() { return limitDex; }
    public void setLimitDex(Integer limitDex) { this.limitDex = limitDex; }

    public Integer getLimitInt() { return limitInt; }
    public void setLimitInt(Integer limitInt) { this.limitInt = limitInt; }

    public Integer getLimitCos() { return limitCos; }
    public void setLimitCos(Integer limitCos) { this.limitCos = limitCos; }

    public Integer getOtherwiseFlag() { return otherwiseFlag; }
    public void setOtherwiseFlag(Integer otherwiseFlag) { this.otherwiseFlag = otherwiseFlag; }

    public Integer getIsProgress() { return isProgress; }
    public void setIsProgress(Integer isProgress) { this.isProgress = isProgress; }

    public String getLogicOperator() { return logicOperator; }
    public void setLogicOperator(String logicOperator) { this.logicOperator = logicOperator; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
