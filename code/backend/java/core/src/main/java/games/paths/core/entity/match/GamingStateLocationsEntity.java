package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * GamingStateLocationsEntity - JPA entity mapped to "gaming_state_locations".
 * Schema defined by Flyway migration V0.10.7.
 *
 * <p>Step 19: One row per location of the story is created when the match
 * starts. Tracks whether automatic events at the location have already
 * fired (flag_already_actived) and the residual time counter copied from
 * {@code list_locations.counter_time}.</p>
 */
@Entity
@Table(name = "gaming_state_locations")
@IdClass(GamingStateLocationsEntityId.class)
public class GamingStateLocationsEntity {

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Id
    @Column(name = "id_location")
    private Long idLocation;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "flag_already_actived", nullable = false)
    private Integer flagAlreadyActived;

    @Column(name = "clock_counter")
    private Integer clockCounter;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (flagAlreadyActived == null) flagAlreadyActived = 0;
        if (clockCounter == null) clockCounter = 0;
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
    }

    @PreUpdate
    protected void onUpdate() {
        tsUpdate = java.time.Instant.now().toString();
    }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    public Long getIdLocation() { return idLocation; }
    public void setIdLocation(Long idLocation) { this.idLocation = idLocation; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getFlagAlreadyActived() { return flagAlreadyActived; }
    public void setFlagAlreadyActived(Integer flagAlreadyActived) { this.flagAlreadyActived = flagAlreadyActived; }

    public Integer getClockCounter() { return clockCounter; }
    public void setClockCounter(Integer clockCounter) { this.clockCounter = clockCounter; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
