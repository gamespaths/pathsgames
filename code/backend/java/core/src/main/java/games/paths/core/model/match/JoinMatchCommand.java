package games.paths.core.model.match;

import java.util.ArrayList;
import java.util.List;

/**
 * JoinMatchCommand - Domain command for {@code POST /api/matches/{uuid}/join}.
 *
 * <p>Step 21 — a player joins a match and instantiates a character. The
 * character template, class and traits are optional; when omitted the command
 * service falls back to the loadout stored on the match at creation time
 * (the single-player path).</p>
 */
public class JoinMatchCommand {

    private String matchUuid;
    private String userUuid;
    private String characterTemplateUuid;
    private String classUuid;
    private List<String> traitUuids = new ArrayList<>();

    public JoinMatchCommand() {
    }

    public JoinMatchCommand(String matchUuid, String userUuid, String characterTemplateUuid,
                            String classUuid, List<String> traitUuids) {
        this.matchUuid = matchUuid;
        this.userUuid = userUuid;
        this.characterTemplateUuid = characterTemplateUuid;
        this.classUuid = classUuid;
        this.traitUuids = traitUuids != null ? traitUuids : new ArrayList<>();
    }

    public String getMatchUuid() { return matchUuid; }
    public void setMatchUuid(String matchUuid) { this.matchUuid = matchUuid; }

    public String getUserUuid() { return userUuid; }
    public void setUserUuid(String userUuid) { this.userUuid = userUuid; }

    public String getCharacterTemplateUuid() { return characterTemplateUuid; }
    public void setCharacterTemplateUuid(String characterTemplateUuid) { this.characterTemplateUuid = characterTemplateUuid; }

    public String getClassUuid() { return classUuid; }
    public void setClassUuid(String classUuid) { this.classUuid = classUuid; }

    public List<String> getTraitUuids() { return traitUuids; }
    public void setTraitUuids(List<String> traitUuids) {
        this.traitUuids = traitUuids != null ? traitUuids : new ArrayList<>();
    }
}
