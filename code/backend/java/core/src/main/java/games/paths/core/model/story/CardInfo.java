package games.paths.core.model.story;

/**
 * CardInfo - Domain model for a visual card summary.
 * Used within story summaries to provide card/image information.
 */
public class CardInfo {

    private final String uuid;
    private final String imageUrl;
    private final String alternativeImage;
    private final String awesomeIcon;
    private final String styleMain;
    private final String styleDetail;
    private final String title;

    private CardInfo(Builder builder) {
        this.uuid = builder.uuid;
        this.imageUrl = builder.imageUrl;
        this.alternativeImage = builder.alternativeImage;
        this.awesomeIcon = builder.awesomeIcon;
        this.styleMain = builder.styleMain;
        this.styleDetail = builder.styleDetail;
        this.title = builder.title;
    }

    public String getUuid() { return uuid; }
    public String getImageUrl() { return imageUrl; }
    public String getAlternativeImage() { return alternativeImage; }
    public String getAwesomeIcon() { return awesomeIcon; }
    public String getStyleMain() { return styleMain; }
    public String getStyleDetail() { return styleDetail; }
    public String getTitle() { return title; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String uuid;
        private String imageUrl;
        private String alternativeImage;
        private String awesomeIcon;
        private String styleMain;
        private String styleDetail;
        private String title;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder imageUrl(String imageUrl) { this.imageUrl = imageUrl; return this; }
        public Builder alternativeImage(String alternativeImage) { this.alternativeImage = alternativeImage; return this; }
        public Builder awesomeIcon(String awesomeIcon) { this.awesomeIcon = awesomeIcon; return this; }
        public Builder styleMain(String styleMain) { this.styleMain = styleMain; return this; }
        public Builder styleDetail(String styleDetail) { this.styleDetail = styleDetail; return this; }
        public Builder title(String title) { this.title = title; return this; }

        public CardInfo build() {
            return new CardInfo(this);
        }
    }

    @Override
    public String toString() {
        return "CardInfo{uuid='" + uuid + "', imageUrl='" + imageUrl + "'}";
    }
}
