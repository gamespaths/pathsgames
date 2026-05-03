package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * CreatorEntity - JPA entity mapped to the "list_creator" table.
 */
@Entity
@Table(name = "list_creator")
@IdClass(StoryScopedEntityId.class)
public class CreatorEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

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

}
