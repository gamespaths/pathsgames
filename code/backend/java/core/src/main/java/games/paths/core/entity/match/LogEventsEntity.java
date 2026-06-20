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

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (timestamp == null) timestamp = now;
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

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
