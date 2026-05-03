package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * CardEntity - JPA entity mapped to the "list_cards" table.
 */
@Entity
@Table(name = "list_cards")
@IdClass(StoryScopedEntityId.class)
public class CardEntity extends BaseStoryEntity {

    @Id
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    @Column(name = "url_immage")
    private String urlImmage;

    @Column(name = "id_text_title")
    private Integer idTextTitle;

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

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @Override
    public Long getIdStory() { return super.getIdStory(); }

    @Override
    public void setIdStory(Long idStory) {
        super.setIdStory(idStory);
        this.idStoryPk = idStory;
    }


    public String getUrlImmage() { return urlImmage; }
    public void setUrlImmage(String urlImmage) { this.urlImmage = urlImmage; }

    public Integer getIdTextTitle() { return idTextTitle; }
    public void setIdTextTitle(Integer idTextTitle) { this.idTextTitle = idTextTitle; }


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

}
