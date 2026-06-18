package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TimeAdvancementPort;

/**
 * Per-character clock/sleep state inside {@link ClockResponse} (Step 25).
 */
public class ClockCharacterResponse {

    private String characterUuid;
    private boolean isSleeping;
    private int energy;

    public static ClockCharacterResponse fromModel(TimeAdvancementPort.ClockCharacter c) {
        ClockCharacterResponse r = new ClockCharacterResponse();
        r.characterUuid = c.characterUuid();
        r.isSleeping = c.isSleeping();
        r.energy = c.energy();
        return r;
    }

    public String getCharacterUuid() { return characterUuid; }
    public boolean getIsSleeping() { return isSleeping; }
    public int getEnergy() { return energy; }
}
