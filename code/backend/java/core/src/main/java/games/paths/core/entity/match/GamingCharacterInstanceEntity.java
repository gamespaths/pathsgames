package games.paths.core.entity.match;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * GamingCharacterInstanceEntity - JPA entity mapped to "gaming_character_instance".
 * Schema defined by Flyway migration V0.10.6.
 *
 * <p>Step 21: a player materialises a character into a match by joining. The
 * row holds the final computed stats (template + class + difficulty + traits),
 * the current location and the runtime state flags. The {@code (id, id_match)}
 * key, {@code uuid} and audit timestamps come from
 * {@link AbstractMatchScopedEntity}.</p>
 */
@Entity
@Table(name = "gaming_character_instance")
@IdClass(GamingCharacterInstanceEntityId.class)
public class GamingCharacterInstanceEntity extends AbstractMatchScopedEntity {

    @Column(name = "id_user", nullable = false)
    private Long idUser;

    @Column(name = "id_character_template", nullable = false)
    private Long idCharacterTemplate;

    @Column(nullable = false)
    private Integer dexterity;

    @Column(nullable = false)
    private Integer intelligence;

    @Column(nullable = false)
    private Integer constitution;

    @Column(nullable = false)
    private Integer energy;

    @Column(nullable = false)
    private Integer life;

    @Column(nullable = false)
    private Integer sad;

    @Column(name = "id_location")
    private Long idLocation;

    @Column(name = "is_sleeping", nullable = false)
    private Boolean isSleeping;

    @Column(name = "is_coma", nullable = false)
    private Boolean isComa;

    @Column(name = "clock_in_coma")
    private Integer clockInComa;

    @Column(name = "timestamp_last_pass")
    private String timestampLastPass;

    @Column(name = "counter_consecutive_pass", nullable = false)
    private Integer counterConsecutivePass;

    @PrePersist
    protected void onCreate() {
        applyUuidAndTimestamps();
        if (dexterity == null) dexterity = 1;
        if (intelligence == null) intelligence = 1;
        if (constitution == null) constitution = 1;
        if (energy == null) energy = 0;
        if (life == null) life = 1;
        if (sad == null) sad = 0;
        if (isSleeping == null) isSleeping = false;
        if (isComa == null) isComa = false;
        if (clockInComa == null) clockInComa = 0;
        if (counterConsecutivePass == null) counterConsecutivePass = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        applyUpdateTimestamp();
    }

    public Long getIdUser() { return idUser; }
    public void setIdUser(Long idUser) { this.idUser = idUser; }

    public Long getIdCharacterTemplate() { return idCharacterTemplate; }
    public void setIdCharacterTemplate(Long idCharacterTemplate) { this.idCharacterTemplate = idCharacterTemplate; }

    public Integer getDexterity() { return dexterity; }
    public void setDexterity(Integer dexterity) { this.dexterity = dexterity; }

    public Integer getIntelligence() { return intelligence; }
    public void setIntelligence(Integer intelligence) { this.intelligence = intelligence; }

    public Integer getConstitution() { return constitution; }
    public void setConstitution(Integer constitution) { this.constitution = constitution; }

    public Integer getEnergy() { return energy; }
    public void setEnergy(Integer energy) { this.energy = energy; }

    public Integer getLife() { return life; }
    public void setLife(Integer life) { this.life = life; }

    public Integer getSad() { return sad; }
    public void setSad(Integer sad) { this.sad = sad; }

    public Long getIdLocation() { return idLocation; }
    public void setIdLocation(Long idLocation) { this.idLocation = idLocation; }

    public Boolean getIsSleeping() { return isSleeping; }
    public void setIsSleeping(Boolean isSleeping) { this.isSleeping = isSleeping; }

    public Boolean getIsComa() { return isComa; }
    public void setIsComa(Boolean isComa) { this.isComa = isComa; }

    public Integer getClockInComa() { return clockInComa; }
    public void setClockInComa(Integer clockInComa) { this.clockInComa = clockInComa; }

    public String getTimestampLastPass() { return timestampLastPass; }
    public void setTimestampLastPass(String timestampLastPass) { this.timestampLastPass = timestampLastPass; }

    public Integer getCounterConsecutivePass() { return counterConsecutivePass; }
    public void setCounterConsecutivePass(Integer counterConsecutivePass) { this.counterConsecutivePass = counterConsecutivePass; }
}
