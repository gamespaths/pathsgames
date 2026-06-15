package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * LogClockHistoryEntity - JPA entity mapped to "log_clock_history".
 * Schema defined by Flyway migration V0.10.9 (timestamp columns relaxed to
 * VARCHAR by V0.19.1).
 *
 * <p>Step 25: one row is appended every time the match clock advances to a new
 * time unit. The {@code id} is part of the composite primary key {@code (id,
 * id_match)} and is globally unique; it is assigned explicitly by the adapter
 * (SQLite does not auto-increment it).</p>
 */
@Entity
@Table(name = "log_clock_history")
@IdClass(LogClockHistoryEntityId.class)
public class LogClockHistoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(nullable = false)
    private Integer clock;

    @Column
    private String weather;

    @Column(name = "timestamp_start")
    private String timestampStart;

    @Column(name = "timestamp_end")
    private String timestampEnd;

    @Column(name = "id_event_start")
    private Long idEventStart;

    @Column(name = "id_event_end")
    private Long idEventEnd;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (clock == null) clock = 0;
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getClock() { return clock; }
    public void setClock(Integer clock) { this.clock = clock; }

    public String getWeather() { return weather; }
    public void setWeather(String weather) { this.weather = weather; }

    public String getTimestampStart() { return timestampStart; }
    public void setTimestampStart(String timestampStart) { this.timestampStart = timestampStart; }

    public String getTimestampEnd() { return timestampEnd; }
    public void setTimestampEnd(String timestampEnd) { this.timestampEnd = timestampEnd; }

    public Long getIdEventStart() { return idEventStart; }
    public void setIdEventStart(Long idEventStart) { this.idEventStart = idEventStart; }

    public Long getIdEventEnd() { return idEventEnd; }
    public void setIdEventEnd(Long idEventEnd) { this.idEventEnd = idEventEnd; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
