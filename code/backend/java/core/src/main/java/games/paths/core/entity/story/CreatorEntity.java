package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * CreatorEntity - JPA entity mapped to the "list_creator" table.
 */
@Entity
@Table(name = "list_creator")
public class CreatorEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_story")
    private Long idStory;

    @Column(name = "id_text")
    private Integer idText;

    private String link;

    private String url;

    @Column(name = "url_image")
    private String urlImage;

    @Column(name = "url_emote")
    private String urlEmote;

    @Column(name = "url_instagram")
    private String urlInstagram;

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

    public Integer getIdText() { return idText; }
    public void setIdText(Integer idText) { this.idText = idText; }

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

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
