package games.paths.adapters.rest.dto;

import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchRegistryGroup;

import java.util.ArrayList;
import java.util.List;

/**
 * MatchRegistryResponse - Step 36. Body of GET /api/match/&#123;uuid&#125;/registry: the visible
 * keys of the match, grouped by the category their {@code list_keys} definition gives them.
 */
public class MatchRegistryResponse {

    private List<GroupDto> groups = new ArrayList<>();

    public static MatchRegistryResponse fromModel(List<MatchRegistryGroup> model) {
        MatchRegistryResponse r = new MatchRegistryResponse();
        if (model == null) {
            return r;
        }
        for (MatchRegistryGroup g : model) {
            r.groups.add(GroupDto.fromModel(g));
        }
        return r;
    }

    public List<GroupDto> getGroups() { return groups; }
    public void setGroups(List<GroupDto> groups) { this.groups = groups; }

    public static class GroupDto {
        private String category;
        private List<EntryDto> entries = new ArrayList<>();

        public static GroupDto fromModel(MatchRegistryGroup g) {
            GroupDto d = new GroupDto();
            d.category = g.category();
            for (MatchRegistryEntry e : g.entries()) {
                d.entries.add(EntryDto.fromModel(e));
            }
            return d;
        }

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public List<EntryDto> getEntries() { return entries; }
        public void setEntries(List<EntryDto> entries) { this.entries = entries; }
    }

    public static class EntryDto {
        private String uuid;
        private String key;
        private String stringValue;
        private Integer intValue;
        private Long idCharacter;
        private String category;
        private boolean visible;
        private Integer priority;
        private Integer idCard;
        private CardInfoResponse card;

        public static EntryDto fromModel(MatchRegistryEntry e) {
            EntryDto d = new EntryDto();
            d.uuid = e.getUuid();
            d.key = e.getKey();
            d.stringValue = e.getStringValue();
            d.intValue = e.getIntValue();
            d.idCharacter = e.getIdCharacter();
            d.category = e.getCategory();
            d.visible = e.isVisible();
            d.priority = e.getPriority();
            d.idCard = e.getIdCard();
            d.card = CardInfoResponse.fromModel(e.getCard());
            return d;
        }

        public String getUuid() { return uuid; }
        public void setUuid(String uuid) { this.uuid = uuid; }
        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getStringValue() { return stringValue; }
        public void setStringValue(String stringValue) { this.stringValue = stringValue; }
        public Integer getIntValue() { return intValue; }
        public void setIntValue(Integer intValue) { this.intValue = intValue; }
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
        public CardInfoResponse getCard() { return card; }
        public void setCard(CardInfoResponse card) { this.card = card; }
    }
}
