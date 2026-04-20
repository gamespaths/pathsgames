package games.paths.adapters.rest.dto;

/**
 * CreatorInfoResponse - REST response DTO for a content creator profile.
 *
 * <p>Added in Step 16.</p>
 */
public class CreatorInfoResponse {

    private String uuid;
    private String name;
    private String link;
    private String url;
    private String urlImage;
    private String urlEmote;
    private String urlInstagram;

    public CreatorInfoResponse() {}

    public CreatorInfoResponse(String uuid, String name, String link, String url,
                               String urlImage, String urlEmote, String urlInstagram) {
        this.uuid = uuid;
        this.name = name;
        this.link = link;
        this.url = url;
        this.urlImage = urlImage;
        this.urlEmote = urlEmote;
        this.urlInstagram = urlInstagram;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

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
