package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * CardEntity - JPA entity mapped to the "list_cards" table.
 */
@Entity
@Table(name = "list_cards")
@IdClass(StoryScopedEntityId.class)
public class CardEntity extends BaseStoryScopedEntity {

    @Column(name = "card_type")
    private String cardType;

    @Column(name = "url_immage")
    private String urlImage;

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

    @Column(name = "style_image_little")
    private String styleImageLittle;

    @Column(name = "style_image_medium")
    private String styleImageMedium;

    @Column(name = "style_image_large")
    private String styleImageLarge;

    // === Getters & Setters ===

    public String getCardType() { return cardType; }
    public void setCardType(String cardType) { this.cardType = cardType; }

    public String getUrlImage() { return urlImage; }
    public void setUrlImage(String urlImage) { this.urlImage = urlImage; }

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

    public String getStyleImageLittle() { return styleImageLittle; }
    public void setStyleImageLittle(String styleImageLittle) { this.styleImageLittle = styleImageLittle; }

    public String getStyleImageMedium() { return styleImageMedium; }
    public void setStyleImageMedium(String styleImageMedium) { this.styleImageMedium = styleImageMedium; }

    public String getStyleImageLarge() { return styleImageLarge; }
    public void setStyleImageLarge(String styleImageLarge) { this.styleImageLarge = styleImageLarge; }

}
