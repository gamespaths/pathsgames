
package games.paths.core.model.story;

/**
 * CardInfo - Domain model for a visual card with resolved text
 * and optional creator information.
 * Used within story summaries and content detail APIs.
 *
 * <p>Enhanced in Step 16 to include copyright and creator fields
 * (consolidated from the former CardDetail type).</p>
 */
public class CardInfo {

    private final String uuid;
    private final String imageUrl;
    private final String alternativeImage;
    private final String awesomeIcon;
    private final String styleMain;
    private final String styleDetail;
    private final String title;
    private final String description;
    private final String copyrightText;
    private final String linkCopyright;
    private final CreatorInfo creator;

    private CardInfo(Builder builder) {
        this.uuid = builder.uuid;
        this.imageUrl = builder.imageUrl;
        this.alternativeImage = builder.alternativeImage;
        this.awesomeIcon = builder.awesomeIcon;
        this.styleMain = builder.styleMain;
        this.styleDetail = builder.styleDetail;
        this.title = builder.title;
        this.description = builder.description;
        this.copyrightText = builder.copyrightText;
        this.linkCopyright = builder.linkCopyright;
        this.creator = builder.creator;
    }

    public String getUuid() { return uuid; }
    public String getImageUrl() { return imageUrl; }
    public String getAlternativeImage() { return alternativeImage; }
    public String getAwesomeIcon() { return awesomeIcon; }
    public String getStyleMain() { return styleMain; }
    public String getStyleDetail() { return styleDetail; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getCopyrightText() { return copyrightText; }
    public String getLinkCopyright() { return linkCopyright; }
    public CreatorInfo getCreator() { return creator; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
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
        private CreatorInfo creator;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder imageUrl(String imageUrl) { this.imageUrl = imageUrl; return this; }
        public Builder alternativeImage(String alternativeImage) { this.alternativeImage = alternativeImage; return this; }
        public Builder awesomeIcon(String awesomeIcon) { this.awesomeIcon = awesomeIcon; return this; }
        public Builder styleMain(String styleMain) { this.styleMain = styleMain; return this; }
        public Builder styleDetail(String styleDetail) { this.styleDetail = styleDetail; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder copyrightText(String copyrightText) { this.copyrightText = copyrightText; return this; }
        public Builder linkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; return this; }
        public Builder creator(CreatorInfo creator) { this.creator = creator; return this; }

        public CardInfo build() {
            return new CardInfo(this);
        }
    }

    @Override
    public String toString() {
        return "CardInfo{uuid='" + uuid + "', imageUrl='" + imageUrl + "'}";
    }
}
