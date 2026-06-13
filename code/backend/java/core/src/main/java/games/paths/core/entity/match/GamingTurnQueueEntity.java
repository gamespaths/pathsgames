package games.paths.core.entity.match;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * GamingTurnQueueEntity - JPA entity mapped to "gaming_turn_queue".
 * Schema defined by Flyway migration V0.10.7; the {@code status} column is
 * added by V0.24.0.
 *
 * <p>Step 24: one row per character of a single-player match, created when the
 * match starts. Holds the calculated turn {@code priority}
 * ({@code (DEX*3 + INT*2 + COS*1) * 1000 + LIFE*10 + idCharacter}), the
 * {@code clock} it belongs to, the voluntary {@code pass_counter} and the turn
 * lifecycle {@code status} (WAITING → ACTIVE → COMPLETED).</p>
 */
@Entity
@Table(name = "gaming_turn_queue")
@IdClass(GamingTurnQueueEntityId.class)
public class GamingTurnQueueEntity {

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Id
    @Column(name = "id_character_match")
    private Long idCharacterMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(nullable = false)
    private Integer clock;

    @Column(name = "timestamp_start")
    private LocalDateTime timestampStart;

    @Column(name = "timestamp_end")
    private LocalDateTime timestampEnd;

    @Column(name = "pass_counter", nullable = false)
    private Integer passCounter;

    @Column(nullable = false)
    private Long priority;

    @Column(nullable = false)
    private String status;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (clock == null) clock = 0;
        if (passCounter == null) passCounter = 0;
        if (priority == null) priority = 0L;
        if (status == null) status = "WAITING";
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
    }

    @PreUpdate
    protected void onUpdate() {
        tsUpdate = java.time.Instant.now().toString();
    }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    public Long getIdCharacterMatch() { return idCharacterMatch; }
    public void setIdCharacterMatch(Long idCharacterMatch) { this.idCharacterMatch = idCharacterMatch; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getClock() { return clock; }
    public void setClock(Integer clock) { this.clock = clock; }

    public LocalDateTime getTimestampStart() { return timestampStart; }
    public void setTimestampStart(LocalDateTime timestampStart) { this.timestampStart = timestampStart; }

    public LocalDateTime getTimestampEnd() { return timestampEnd; }
    public void setTimestampEnd(LocalDateTime timestampEnd) { this.timestampEnd = timestampEnd; }

    public Integer getPassCounter() { return passCounter; }
    public void setPassCounter(Integer passCounter) { this.passCounter = passCounter; }

    public Long getPriority() { return priority; }
    public void setPriority(Long priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
