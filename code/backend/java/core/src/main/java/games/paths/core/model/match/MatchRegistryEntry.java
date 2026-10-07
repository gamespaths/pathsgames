package games.paths.core.model.match;

import games.paths.core.model.story.CardInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * MatchRegistryEntry - Domain model for one row of {@code gaming_state_registry}.
 * Step 36 joins it with its {@code list_keys} definition, so a caller reads the category and
 * visibility the author gave the key, not only the value the engine wrote.
 */
public class MatchRegistryEntry {

    private String uuid;
    private String key;
    /**
     * Step 36.1 — the SET of values the key holds, ordered for display. A single-valued key has
     * one member, a multi-valued one may have many, and an emptied key has none.
     */
    private List<String> values = new ArrayList<>();
    /** True when the key accumulates instead of replacing — visible so a client can say which. */
    private boolean multiValue;
    /** Step 36 - who wrote the value last; null while nothing has written it. */
    private Long idCharacter;
    private String category;
    private boolean visible;
    private Integer priority;
    private Integer idCard;
    private CardInfo card;

    public MatchRegistryEntry() {
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public List<String> getValues() { return values; }
    public void setValues(List<String> values) { this.values = values; }

    public boolean isMultiValue() { return multiValue; }
    public void setMultiValue(boolean multiValue) { this.multiValue = multiValue; }

    public Long getIdCharacter() { return idCharacter; }
    public void setIdCharacter(Long idCharacter) { this.idCharacter = idCharacter; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public boolean isVisible() { return visible; }
    public void setVisible(boolean visible) { this.visible = visible; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfo getCard() { return card; }
    public void setCard(CardInfo card) { this.card = card; }
}
