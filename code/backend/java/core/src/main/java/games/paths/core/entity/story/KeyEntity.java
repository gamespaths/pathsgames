package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * KeyEntity - JPA entity mapped to the "list_keys" table.
 */
@Entity
@Table(name = "list_keys")
@IdClass(StoryScopedEntityId.class)
public class KeyEntity extends BaseStoryScopedEntity {

    @Column(nullable = false)
    private String name;

    private String value;

    @Column(name = "\"group\"")
    private String group;

    private Integer priority;

    private String visibility;

    /** Step 36.1 - 1 = the key holds a SET, each write adding a member; 0 = one value. */
    @Column(name = "multi_value")
    private Integer multiValue;

    @PrePersist
    protected void onCreate() {
        if (priority == null) priority = 0;
        if (visibility == null) visibility = "PUBLIC";
        if (multiValue == null) multiValue = 0;
    }

    // === Getters & Setters ===

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public String getVisibility() { return visibility; }

    public Integer getMultiValue() { return multiValue; }
    public void setMultiValue(Integer multiValue) { this.multiValue = multiValue; }
    public void setVisibility(String visibility) { this.visibility = visibility; }

}
