package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * GamingBackpackResourcesEntity - JPA entity mapped to "gaming_backpack_resources".
 * Schema defined by Flyway migration V0.10.6.
 *
 * <p>Step 21: one backpack row per character instance, seeded with default
 * resource values when the character joins the match.</p>
 */
@Entity
@Table(name = "gaming_backpack_resources")
@IdClass(GamingBackpackResourcesEntityId.class)
public class GamingBackpackResourcesEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_character_match", nullable = false)
    private Long idCharacterMatch;

    @Column(nullable = false)
    private Integer food;

    @Column(nullable = false)
    private Integer magic;

    @Column(nullable = false)
    private Integer coin;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (food == null) food = 0;
        if (magic == null) magic = 0;
        if (coin == null) coin = 0;
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
