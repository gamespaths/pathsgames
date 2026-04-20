package games.paths.core.model.story;

/**
 * CreatorInfo - Domain model for a content creator profile.
 * Used to expose creator details for cards, texts, and stories.
 *
 * <p>Added in Step 16 for the content detail APIs.</p>
 */
public class CreatorInfo {

    private final String uuid;
    private final String name;
    private final String link;
    private final String url;
    private final String urlImage;
    private final String urlEmote;
    private final String urlInstagram;

    private CreatorInfo(Builder builder) {
        this.uuid = builder.uuid;
        this.name = builder.name;
        this.link = builder.link;
        this.url = builder.url;
        this.urlImage = builder.urlImage;
        this.urlEmote = builder.urlEmote;
        this.urlInstagram = builder.urlInstagram;
    }

    public String getUuid() { return uuid; }
    public String getName() { return name; }
    public String getLink() { return link; }
    public String getUrl() { return url; }
    public String getUrlImage() { return urlImage; }
    public String getUrlEmote() { return urlEmote; }
    public String getUrlInstagram() { return urlInstagram; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String uuid;
        private String name;
        private String link;
        private String url;
        private String urlImage;
        private String urlEmote;
        private String urlInstagram;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder link(String link) { this.link = link; return this; }
        public Builder url(String url) { this.url = url; return this; }
        public Builder urlImage(String urlImage) { this.urlImage = urlImage; return this; }
        public Builder urlEmote(String urlEmote) { this.urlEmote = urlEmote; return this; }
        public Builder urlInstagram(String urlInstagram) { this.urlInstagram = urlInstagram; return this; }

        public CreatorInfo build() {
            return new CreatorInfo(this);
        }
    }

    @Override
    public String toString() {
        return "CreatorInfo{uuid='" + uuid + "', name='" + name + "'}";
    }
}
