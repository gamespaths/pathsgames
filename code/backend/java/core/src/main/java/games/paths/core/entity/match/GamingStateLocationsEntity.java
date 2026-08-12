package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * GamingStateLocationsEntity - JPA entity mapped to "gaming_state_locations".
 * Schema defined by Flyway migration V0.10.7.
 *
 * <p>Step 19: One row per location of the story is created when the match
 * starts. Tracks the residual time counter copied from
 * {@code list_locations.counter_time}.</p>
 *
 * <p>The two flags mean different things and must not be confused:</p>
 * <ul>
 *   <li>{@code flagAlreadyActived} (Step 26) — <b>this location's counter has been
 *       consumed</b>. It is the latch that makes the counter a one-shot fuse and
 *       stops an exhausted counter from being re-seeded.</li>
 *   <li>{@code flagVisited} (Step 33, V0.33.0) — <b>the party has entered this
 *       location at least once</b>. Decides {@code id_event_if_first_time} versus
 *       {@code id_event_not_first_time}. Match-scoped, so first entry belongs to
 *       the match and not to the character; the story's {@code id_location_start}
 *       is seeded to 1 at match creation.</li>
 * </ul>
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

    /** Step 33 (V0.33.0) — the party has entered this location at least once. */
    @Column(name = "flag_visited", nullable = false)
    private Integer flagVisited;

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
        if (flagVisited == null) flagVisited = 0;
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

    public Integer getFlagVisited() { return flagVisited; }
    public void setFlagVisited(Integer flagVisited) { this.flagVisited = flagVisited; }

    public Integer getClockCounter() { return clockCounter; }
    public void setClockCounter(Integer clockCounter) { this.clockCounter = clockCounter; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
