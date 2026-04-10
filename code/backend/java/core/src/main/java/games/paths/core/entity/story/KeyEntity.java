package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * KeyEntity - JPA entity mapped to the "list_keys" table.
 */
@Entity
@Table(name = "list_keys")
public class KeyEntity extends BaseStoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String value;

    @Column(name = "\"group\"")
    private String group;

    private Integer priority;

    private String visibility;

    @PrePersist
    protected void onCreate() {
        if (priority == null) priority = 0;
        if (visibility == null) visibility = "PUBLIC";
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }



    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }


    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }

}
