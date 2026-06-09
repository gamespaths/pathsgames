package games.paths.adapters.rest.dto;

import java.util.List;

/**
 * JoinMatchRequest - request body for {@code POST /api/matches/{uuid}/join}.
 * Step 21. Every field is optional; when omitted the backend falls back to the
 * loadout stored on the match at creation time (single-player path).
 */
public class JoinMatchRequest {

    private String characterTemplateUuid;
    private String classUuid;
    private List<String> traitUuids;

    public JoinMatchRequest() {
    }

    public String getCharacterTemplateUuid() { return characterTemplateUuid; }
    public void setCharacterTemplateUuid(String characterTemplateUuid) { this.characterTemplateUuid = characterTemplateUuid; }

    public String getClassUuid() { return classUuid; }
    public void setClassUuid(String classUuid) { this.classUuid = classUuid; }

    public List<String> getTraitUuids() { return traitUuids; }
    public void setTraitUuids(List<String> traitUuids) { this.traitUuids = traitUuids; }
}
