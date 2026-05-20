package games.paths.adapters.rest.dto;

import java.util.List;

/**
 * MatchCreateRequest - Request body for {@code POST /api/matches}.
 * Step 19 — single-player match creation.
 *
 * <p>Step 0.19.9 — the request now carries the full creator loadout: the
 * selected character template, class, trait uuids and a single-player flag
 * ({@code 1} single-player, {@code 0} multiplayer). All loadout fields are
 * optional; {@code storyUuid} and {@code difficultyUuid} stay mandatory.</p>
 */
public class MatchCreateRequest {

    private String storyUuid;
    private String difficultyUuid;
    private String name;
    private String characterTemplateUuid;
    private String classUuid;
    private List<String> traitUuids;
    private Integer singlePlayer;

    public MatchCreateRequest() {
    }

    public String getStoryUuid() { return storyUuid; }
    public void setStoryUuid(String storyUuid) { this.storyUuid = storyUuid; }

    public String getDifficultyUuid() { return difficultyUuid; }
    public void setDifficultyUuid(String difficultyUuid) { this.difficultyUuid = difficultyUuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCharacterTemplateUuid() { return characterTemplateUuid; }
    public void setCharacterTemplateUuid(String characterTemplateUuid) {
        this.characterTemplateUuid = characterTemplateUuid;
    }

    public String getClassUuid() { return classUuid; }
    public void setClassUuid(String classUuid) { this.classUuid = classUuid; }

    public List<String> getTraitUuids() { return traitUuids; }
    public void setTraitUuids(List<String> traitUuids) { this.traitUuids = traitUuids; }

    public Integer getSinglePlayer() { return singlePlayer; }
    public void setSinglePlayer(Integer singlePlayer) { this.singlePlayer = singlePlayer; }
}
