package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * CardEntity - JPA entity mapped to the "list_cards" table.
 */
@Entity
@Table(name = "list_cards")
public class CardEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_story")
    private Long idStory;

    @Column(name = "url_immage")
    private String urlImmage;

    @Column(name = "id_text_title")
    private Integer idTextTitle;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

    @Column(name = "id_text_copyright")
    private Integer idTextCopyright;

    @Column(name = "link_copyright")
    private String linkCopyright;

    @Column(name = "id_creator")
    private Integer idCreator;

    @Column(name = "alternative_image")
    private String alternativeImage;

    @Column(name = "awesome_icon")
    private String awesomeIcon;

    @Column(name = "style_main")
    private String styleMain;

    @Column(name = "style_detail")
    private String styleDetail;

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

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Long getIdStory() { return idStory; }
    public void setIdStory(Long idStory) { this.idStory = idStory; }

    public String getUrlImmage() { return urlImmage; }
    public void setUrlImmage(String urlImmage) { this.urlImmage = urlImmage; }

    public Integer getIdTextTitle() { return idTextTitle; }
    public void setIdTextTitle(Integer idTextTitle) { this.idTextTitle = idTextTitle; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

    public Integer getIdTextCopyright() { return idTextCopyright; }
    public void setIdTextCopyright(Integer idTextCopyright) { this.idTextCopyright = idTextCopyright; }

    public String getLinkCopyright() { return linkCopyright; }
    public void setLinkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; }

    public Integer getIdCreator() { return idCreator; }
    public void setIdCreator(Integer idCreator) { this.idCreator = idCreator; }

    public String getAlternativeImage() { return alternativeImage; }
    public void setAlternativeImage(String alternativeImage) { this.alternativeImage = alternativeImage; }

    public String getAwesomeIcon() { return awesomeIcon; }
    public void setAwesomeIcon(String awesomeIcon) { this.awesomeIcon = awesomeIcon; }

    public String getStyleMain() { return styleMain; }
    public void setStyleMain(String styleMain) { this.styleMain = styleMain; }

    public String getStyleDetail() { return styleDetail; }
    public void setStyleDetail(String styleDetail) { this.styleDetail = styleDetail; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
