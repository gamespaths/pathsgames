package games.paths.adapters.rest.dto;

/**
 * MatchCreateRequest - Request body for {@code POST /api/matches}.
 * Step 19 — single-player match creation.
 */
public class MatchCreateRequest {

    private String storyUuid;
    private String difficultyUuid;
    private String name;
    private String characterTemplateUuid;

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
}
