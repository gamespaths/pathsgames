package games.paths.adapters.rest.dto;

/**
 * CardInfoResponse - REST response DTO for a visual card
 * with resolved text and optional creator information.
 *
 * <p>Enhanced in Step 16 to include description, copyright,
 * and creator fields (consolidated from the former CardDetailResponse).</p>
 */
public class CardInfoResponse {

    private String uuid;
    private String imageUrl;
    private String alternativeImage;
    private String awesomeIcon;
    private String styleMain;
    private String styleDetail;
    private String title;
    private String description;
    private String copyrightText;
    private String linkCopyright;
    private CreatorInfoResponse creator;

    public CardInfoResponse() {}

    public CardInfoResponse(String uuid, String imageUrl, String alternativeImage,
                            String awesomeIcon, String styleMain, String styleDetail,
                            String title, String description,
                            String copyrightText, String linkCopyright,
                            CreatorInfoResponse creator) {
        this.uuid = uuid;
        this.imageUrl = imageUrl;
        this.alternativeImage = alternativeImage;
        this.awesomeIcon = awesomeIcon;
        this.styleMain = styleMain;
        this.styleDetail = styleDetail;
        this.title = title;
        this.description = description;
        this.copyrightText = copyrightText;
        this.linkCopyright = linkCopyright;
        this.creator = creator;
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

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCopyrightText() { return copyrightText; }
    public void setCopyrightText(String copyrightText) { this.copyrightText = copyrightText; }

    public String getLinkCopyright() { return linkCopyright; }
    public void setLinkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; }

    public CreatorInfoResponse getCreator() { return creator; }
    public void setCreator(CreatorInfoResponse creator) { this.creator = creator; }
}
