package games.paths.adapters.rest.dto;

/**
 * CardInfoResponse - REST response DTO for a visual card.
 */
public class CardInfoResponse {

    private String uuid;
    private String imageUrl;
    private String alternativeImage;
    private String awesomeIcon;
    private String styleMain;
    private String styleDetail;
    private String title;

    public CardInfoResponse() {}

    public CardInfoResponse(String uuid, String imageUrl, String alternativeImage,
                            String awesomeIcon, String styleMain, String styleDetail,
                            String title) {
        this.uuid = uuid;
        this.imageUrl = imageUrl;
        this.alternativeImage = alternativeImage;
        this.awesomeIcon = awesomeIcon;
        this.styleMain = styleMain;
        this.styleDetail = styleDetail;
        this.title = title;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getAlternativeImage() { return alternativeImage; }
    public void setAlternativeImage(String alternativeImage) { this.alternativeImage = alternativeImage; }

    public String getAwesomeIcon() { return awesomeIcon; }
    public void setAwesomeIcon(String awesomeIcon) { this.awesomeIcon = awesomeIcon; }

    public String getStyleMain() { return styleMain; }
    public void setStyleMain(String styleMain) { this.styleMain = styleMain; }

    public String getStyleDetail() { return styleDetail; }
    public void setStyleDetail(String styleDetail) { this.styleDetail = styleDetail; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
}
