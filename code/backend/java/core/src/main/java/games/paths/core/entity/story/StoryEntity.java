package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * StoryEntity - JPA entity mapped to the "list_stories" table.
 * Schema defined by Flyway migration V0.10.2.
 */
@Entity
@Table(name = "list_stories")
public class StoryEntity extends BaseStoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_text_title")
    private Integer idTextTitle;

    private String author;

    @Column(name = "version_min")
    private String versionMin;

    @Column(name = "version_max")
    private String versionMax;

    @Column(name = "id_location_start")
    private Integer idLocationStart;

    @Column(name = "id_image")
    private Integer idImage;

    @Column(name = "id_location_all_player_coma")
    private Integer idLocationAllPlayerComa;

    @Column(name = "id_event_all_player_coma")
    private Integer idEventAllPlayerComa;

    @Column(name = "clock_singular_description")
    private String clockSingularDescription;

    @Column(name = "clock_plural_description")
    private String clockPluralDescription;

    @Column(name = "id_event_end_game")
    private Integer idEventEndGame;

    @Column(name = "id_text_copyright")
    private Integer idTextCopyright;

    @Column(name = "link_copyright")
    private String linkCopyright;

    @Column(name = "id_creator")
    private Integer idCreator;

    private String category;

    @Column(name = "\"group\"")
    private String group;

    private String visibility;

    private Integer priority;

    private Integer peghi;

    @PrePersist
    protected void onCreate() {
        if (visibility == null) visibility = "PUBLIC";
        if (priority == null) priority = 0;
        if (peghi == null) peghi = 0;
        if (clockSingularDescription == null) clockSingularDescription = "hour";
        if (clockPluralDescription == null) clockPluralDescription = "hours";
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }


    public Integer getIdTextTitle() { return idTextTitle; }
    public void setIdTextTitle(Integer idTextTitle) { this.idTextTitle = idTextTitle; }


    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getVersionMin() { return versionMin; }
    public void setVersionMin(String versionMin) { this.versionMin = versionMin; }

    public String getVersionMax() { return versionMax; }
    public void setVersionMax(String versionMax) { this.versionMax = versionMax; }

    public Integer getIdLocationStart() { return idLocationStart; }
    public void setIdLocationStart(Integer idLocationStart) { this.idLocationStart = idLocationStart; }

    public Integer getIdImage() { return idImage; }
    public void setIdImage(Integer idImage) { this.idImage = idImage; }

    public Integer getIdLocationAllPlayerComa() { return idLocationAllPlayerComa; }
    public void setIdLocationAllPlayerComa(Integer idLocationAllPlayerComa) { this.idLocationAllPlayerComa = idLocationAllPlayerComa; }

    public Integer getIdEventAllPlayerComa() { return idEventAllPlayerComa; }
    public void setIdEventAllPlayerComa(Integer idEventAllPlayerComa) { this.idEventAllPlayerComa = idEventAllPlayerComa; }

    public String getClockSingularDescription() { return clockSingularDescription; }
    public void setClockSingularDescription(String clockSingularDescription) { this.clockSingularDescription = clockSingularDescription; }

    public String getClockPluralDescription() { return clockPluralDescription; }
    public void setClockPluralDescription(String clockPluralDescription) { this.clockPluralDescription = clockPluralDescription; }

    public Integer getIdEventEndGame() { return idEventEndGame; }
    public void setIdEventEndGame(Integer idEventEndGame) { this.idEventEndGame = idEventEndGame; }

    public Integer getIdTextCopyright() { return idTextCopyright; }
    public void setIdTextCopyright(Integer idTextCopyright) { this.idTextCopyright = idTextCopyright; }

    public String getLinkCopyright() { return linkCopyright; }
    public void setLinkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; }

    public Integer getIdCreator() { return idCreator; }
    public void setIdCreator(Integer idCreator) { this.idCreator = idCreator; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public Integer getPeghi() { return peghi; }
    public void setPeghi(Integer peghi) { this.peghi = peghi; }

}
