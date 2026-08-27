package games.paths.core.port.match;

import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.JoinMatchCommand;

/**
 * CharacterCommandPort - Inbound port for the write-side character operations.
 * Step 21: a player joins a match and instantiates a character.
 */
public interface CharacterCommandPort {

    /**
     * Joins a match: validates the loadout, computes the final statistics
     * (template + class + difficulty + traits) and persists the
     * {@code gaming_character_instance}, {@code gaming_backpack_resources} and
     * {@code gaming_character_traits} rows.
     *
     * @return the created character instance
     * @throws CharacterJoinException for explicit business-rule failures
     */
    CharacterInstanceInfo join(JoinMatchCommand command);

    /**
     * Outcome of an admin statistics change (POST changeStatistics endpoint).
     */
    enum ChangeStatsOutcome {
        /** Statistics were updated successfully. */
        UPDATED,
        /** No match exists with the given uuid. */
        MATCH_NOT_FOUND,
        /** No character instance exists with the given uuid in this match. */
        PLAYER_NOT_FOUND
    }

    /**
     * Admin-only: overrides the current statistics of a character instance.
     * Fields set to {@code -1} are left unchanged. For {@code energy},
     * {@code life} and {@code sad} the new value must be {@code <= max}.
     *
     * @param matchUuid  the match uuid
     * @param playerUuid the character instance uuid (uuid in gaming_character_instance)
     * @param command    the statistics to update (-1 = skip)
     * @return the outcome of the operation
     */
    ChangeStatsOutcome changeStatistics(String matchUuid, String playerUuid, ChangeStatsCommand command);

    /**
     * ChangeStatsCommand - carries the per-field overrides for the admin
     * changeStatistics call. Any field may be {@code null} (no change).
     */
    class ChangeStatsCommand {
        private Integer dex;
        private Integer intel;
        private Integer con;
        private Integer energy;
        private Integer life;
        private Integer sad;
        private Integer coin;
        private Integer food;
        private Integer magic;
        /** State flags: null leaves the flag untouched (the -1 of the numeric fields). */
        private Boolean sleeping;
        private Boolean coma;

        public Boolean getSleeping() { return sleeping; }
        public void setSleeping(Boolean sleeping) { this.sleeping = sleeping; }
        public Boolean getComa() { return coma; }
        public void setComa(Boolean coma) { this.coma = coma; }

        public Integer getDex() { return dex; }
        public void setDex(Integer dex) { this.dex = dex; }
        public Integer getIntel() { return intel; }
        public void setIntel(Integer intel) { this.intel = intel; }
        public Integer getCon() { return con; }
        public void setCon(Integer con) { this.con = con; }
        public Integer getEnergy() { return energy; }
        public void setEnergy(Integer energy) { this.energy = energy; }
        public Integer getLife() { return life; }
        public void setLife(Integer life) { this.life = life; }
        public Integer getSad() { return sad; }
        public void setSad(Integer sad) { this.sad = sad; }
        public Integer getCoin() { return coin; }
        public void setCoin(Integer coin) { this.coin = coin; }
        public Integer getFood() { return food; }
        public void setFood(Integer food) { this.food = food; }
        public Integer getMagic() { return magic; }
        public void setMagic(Integer magic) { this.magic = magic; }
    }

    /**
     * CharacterJoinException - thrown when a character cannot join a match.
     * The {@link #getCode()} value drives the HTTP status mapping in the
     * controller layer.
     */
    class CharacterJoinException extends RuntimeException {

        public enum Code {
            INVALID_INPUT,
            MATCH_NOT_FOUND,
            USER_NOT_FOUND,
            USER_BANNED,
            TEMPLATE_NOT_FOUND,
            CLASS_NOT_FOUND,
            CLASS_NOT_COMPATIBLE,
            ALREADY_JOINED,
            MATCH_NOT_JOINABLE,
            // Step 23 — trait selection validation
            TRAIT_NOT_FOUND,
            TRAIT_DUPLICATED,
            TRAIT_NOT_COMPATIBLE,
            TRAIT_COST_EXCEEDED,
            /** v0.35.2 — the trait is flagged hide_on_start_match and cannot be picked. */
            TRAIT_NOT_SELECTABLE
        }

        private final Code code;

        public CharacterJoinException(Code code, String message) {
            super(message);
            this.code = code;
        }

        public Code getCode() { return code; }
    }
}
