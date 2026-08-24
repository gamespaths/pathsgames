package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * LogMovementEntity - JPA entity mapped to the existing "log_movements" table
 * (created by Flyway V0.10.9 alongside the other log_* tables, for the Step 39
 * action history). Step 28 reuses it to append one row per successful character
 * movement, recording the from/to locations and the total energy spent in the
 * {@code energy} column.
 *
 * <p>The {@code id} is part of the composite primary key {@code (id, id_match)}
 * and globally unique; it is assigned explicitly by the adapter (SQLite does not
 * auto-increment it). The {@code id_event} / {@code id_choise} / {@code log_message}
 * columns of the shared table are not used by movement and stay null.</p>
 */
@Entity
@Table(name = "log_movements")
@IdClass(LogMovementEntityId.class)
public class LogMovementEntity {

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

    @Column(name = "id_location_from")
    private Long idLocationFrom;

    @Column(name = "id_location_to")
    private Long idLocationTo;

    /** Total energy cost paid for the move (edge + location entry + weather). */
    @Column(name = "energy")
    private Integer energy;

    /** v0.35.3 - resources paid for the move (edge only). Zero on a forced move. */
    @Column(name = "food")
    private Integer food;

    @Column(name = "magic")
    private Integer magic;

    @Column(name = "coin")
    private Integer coin;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (energy == null) energy = 0;
        if (food == null) food = 0;
        if (magic == null) magic = 0;
        if (coin == null) coin = 0;
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Long getIdCharacterMatch() { return idCharacterMatch; }
    public void setIdCharacterMatch(Long idCharacterMatch) { this.idCharacterMatch = idCharacterMatch; }

    public Long getIdLocationFrom() { return idLocationFrom; }
    public void setIdLocationFrom(Long idLocationFrom) { this.idLocationFrom = idLocationFrom; }

    public Long getIdLocationTo() { return idLocationTo; }
    public void setIdLocationTo(Long idLocationTo) { this.idLocationTo = idLocationTo; }

    public Integer getEnergy() { return energy; }
    public void setEnergy(Integer energy) { this.energy = energy; }

    public Integer getFood() { return food; }
    public void setFood(Integer food) { this.food = food; }

    public Integer getMagic() { return magic; }
    public void setMagic(Integer magic) { this.magic = magic; }

    public Integer getCoin() { return coin; }
    public void setCoin(Integer coin) { this.coin = coin; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
