package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * TextEntity - JPA entity mapped to the "list_texts" table.
 */
@Entity
@Table(name = "list_texts", uniqueConstraints = @UniqueConstraint(columnNames = {"id_story", "id_text", "lang"}))
public class TextEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

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
        if (lang == null) lang = "en";
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

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
