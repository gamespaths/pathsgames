package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * TextEntity - JPA entity mapped to the "list_texts" table.
 */
@Entity
@Table(name = "list_texts", uniqueConstraints = @UniqueConstraint(columnNames = {"id_story", "id_text", "lang"}))
public class TextEntity extends BaseStoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_text", nullable = false)
    private Integer idText;

    @Column(nullable = false)
    private String lang;

    @Column(name = "short_text")
    private String shortText;

    @Column(name = "long_text")
    private String longText;

    @Column(name = "id_text_copyright")
    private Integer idTextCopyright;

    @Column(name = "link_copyright")
    private String linkCopyright;

    @Column(name = "id_creator")
    private Integer idCreator;

    @PrePersist
    protected void onCreate() {
        if (lang == null) lang = "en";
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }


    public Integer getIdText() { return idText; }
    public void setIdText(Integer idText) { this.idText = idText; }

    public String getLang() { return lang; }
    public void setLang(String lang) { this.lang = lang; }

    public String getShortText() { return shortText; }
    public void setShortText(String shortText) { this.shortText = shortText; }

    public String getLongText() { return longText; }
    public void setLongText(String longText) { this.longText = longText; }

    public Integer getIdTextCopyright() { return idTextCopyright; }
    public void setIdTextCopyright(Integer idTextCopyright) { this.idTextCopyright = idTextCopyright; }

    public String getLinkCopyright() { return linkCopyright; }
    public void setLinkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; }

    public Integer getIdCreator() { return idCreator; }
    public void setIdCreator(Integer idCreator) { this.idCreator = idCreator; }

}
