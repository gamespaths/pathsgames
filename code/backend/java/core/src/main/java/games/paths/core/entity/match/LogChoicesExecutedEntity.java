package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * LogChoicesExecutedEntity - JPA entity mapped to "log_choices_executed".
 * Schema defined by Flyway migration V0.10.9; first written in Step 32.
 *
 * <p>The dedicated history of the choices a match resolved: one row per
 * {@code select-choice}, carrying both the option ({@code idChoise}) and the event that
 * owned it ({@code idEvent}). It is <b>not</b> a duplicate of the {@code CHOICE_SELECTED}
 * marker on {@code log_events}: that marker is engine bookkeeping — it is what
 * {@code countLogMarkers} pairs against {@code EVENT_EXECUTED} to decide whether a cycle is
 * still open — while this table is the narrative record the match-log APIs read.</p>
 *
 * <p>The {@code id} is part of the composite primary key {@code (id, id_match)} and is
 * globally unique; it is assigned explicitly by the adapter (SQLite does not
 * auto-increment it).</p>
 */
@Entity
@Table(name = "log_choices_executed")
@IdClass(LogChoicesExecutedEntityId.class)
public class LogChoicesExecutedEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "clock")
    private Integer clock;

    /** The event that OWNED the resolved option, never the option itself. */
    @Column(name = "id_event")
    private Long idEvent;

    /** Spelled "choise" in the schema since V0.10.9 — kept as-is, it is the column name. */
    @Column(name = "id_choise")
    private Long idChoise;

    @Column(name = "log_message")
    private String logMessage;

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

    public Integer getClock() { return clock; }
    public void setClock(Integer clock) { this.clock = clock; }

    public Long getIdEvent() { return idEvent; }
    public void setIdEvent(Long idEvent) { this.idEvent = idEvent; }

    public Long getIdChoise() { return idChoise; }
    public void setIdChoise(Long idChoise) { this.idChoise = idChoise; }

    public String getLogMessage() { return logMessage; }
    public void setLogMessage(String logMessage) { this.logMessage = logMessage; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
