package games.paths.core.model.match;

import java.util.List;

/**
 * MatchCreateCommand - Domain command sent to {@code MatchCommandPort.createMatch}.
 * Carries the creator user uuid and the player choices for the new match.
 *
 * <p>Step 19: optional name and creator character template uuid; difficulty
 * and story are mandatory.</p>
 *
 * <p>Step 0.19.9: the creator loadout is extended with the selected class,
 * trait uuids and the single-player flag. All loadout fields are optional and
 * are persisted on {@code gaming_match}.</p>
 */
public class MatchCreateCommand {

    private final String userUuid;
    private final String storyUuid;
    private final String difficultyUuid;
    private final String name;
    private final String characterTemplateUuid;
    private final String classUuid;
    private final List<String> traitUuids;
    private final Integer singlePlayer;

    public MatchCreateCommand(String userUuid, String storyUuid, String difficultyUuid,
                              String name, String characterTemplateUuid,
                              String classUuid, List<String> traitUuids, Integer singlePlayer) {
        this.userUuid = userUuid;
        this.storyUuid = storyUuid;
        this.difficultyUuid = difficultyUuid;
        this.name = name;
        this.characterTemplateUuid = characterTemplateUuid;
        this.classUuid = classUuid;
        this.traitUuids = traitUuids;
        this.singlePlayer = singlePlayer;
    }

    public String getUserUuid() { return userUuid; }
    public String getStoryUuid() { return storyUuid; }
    public String getDifficultyUuid() { return difficultyUuid; }
    public String getName() { return name; }
    public String getCharacterTemplateUuid() { return characterTemplateUuid; }
    public String getClassUuid() { return classUuid; }
    public List<String> getTraitUuids() { return traitUuids; }
    public Integer getSinglePlayer() { return singlePlayer; }
}
