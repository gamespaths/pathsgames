package games.paths.core.model.match;

/**
 * MatchCreateCommand - Domain command sent to {@code MatchCommandPort.createMatch}.
 * Carries the creator user uuid and the player choices for the new match.
 *
 * <p>Step 19: optional name and creator character template uuid; difficulty
 * and story are mandatory.</p>
 */
public class MatchCreateCommand {

    private final String userUuid;
    private final String storyUuid;
    private final String difficultyUuid;
    private final String name;
    private final String characterTemplateUuid;

    public MatchCreateCommand(String userUuid, String storyUuid, String difficultyUuid,
                              String name, String characterTemplateUuid) {
        this.userUuid = userUuid;
        this.storyUuid = storyUuid;
        this.difficultyUuid = difficultyUuid;
        this.name = name;
        this.characterTemplateUuid = characterTemplateUuid;
    }

    public String getUserUuid() { return userUuid; }
    public String getStoryUuid() { return storyUuid; }
    public String getDifficultyUuid() { return difficultyUuid; }
    public String getName() { return name; }
    public String getCharacterTemplateUuid() { return characterTemplateUuid; }
}
