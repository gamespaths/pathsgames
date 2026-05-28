package games.paths.adapters.rest.dto;

/**
 * CreatorInfoResponse - REST response DTO for a content creator profile.
 *
 * <p>Added in Step 16.</p>
 */
public class CreatorInfoResponse extends AbstractUuidNameDto {
    private String link;
    private String url;
    private String urlImage;
    private String urlEmote;
    private String urlInstagram;

    public CreatorInfoResponse() {}

    public CreatorInfoResponse(String uuid, String name, String link, String url,
                               String urlImage, String urlEmote, String urlInstagram) {
        super(uuid, name);
        this.link = link;
        this.url = url;
        this.urlImage = urlImage;
        this.urlEmote = urlEmote;
        this.urlInstagram = urlInstagram;
    }

    public String getLink() { return link; }
    public void setLink(String link) { this.link = link; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getUrlImage() { return urlImage; }
    public void setUrlImage(String urlImage) { this.urlImage = urlImage; }

    public String getUrlEmote() { return urlEmote; }
    public void setUrlEmote(String urlEmote) { this.urlEmote = urlEmote; }

    public String getUrlInstagram() { return urlInstagram; }
    public void setUrlInstagram(String urlInstagram) { this.urlInstagram = urlInstagram; }
}
