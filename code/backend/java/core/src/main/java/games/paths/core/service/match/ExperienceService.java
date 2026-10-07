package games.paths.core.service.match;

import games.paths.core.model.match.EffectStatCodec;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.match.ExperiencePort;
import games.paths.core.port.match.ExperienceStorePort;
import games.paths.core.port.match.ExperienceStorePort.CharacterExpView;
import games.paths.core.port.match.ExperienceStorePort.MatchExpView;

import java.util.List;
import java.util.Locale;

/**
 * ExperienceService - Step 38: the use-exp action. Gates in the order the other gameplay
 * services use, prices the point with {@link ExperienceCostCalculator}, writes and logs.
 * v0.38.3: leaves its mark on the registry so a Step 37 mission can wait for it.
 */
public class ExperienceService implements ExperiencePort {

    /** Prefix of the {@code log_events} row the timeline classifies as {@code EXP_USE}. */
    public static final String MSG_EXP_USE = "EXP_USE";

    /** v0.38.3 - registry key counting the use-exp calls of the match: 1 on the first, then 2, 3... */
    public static final String KEY_USE_EXP = "use-exp";

    /** v0.38.3 - prefix of the per-stat key ({@code use-exp-DEX}) holding the value just reached. */
    public static final String KEY_USE_EXP_PREFIX = "use-exp-";

    private final ExperienceStorePort store;
    private final UserAccessPort userAccessPort;
    private final RegistryService registryService;

    public ExperienceService(ExperienceStorePort store, UserAccessPort userAccessPort) {
        this(store, userAccessPort, null);
    }

    public ExperienceService(ExperienceStorePort store, UserAccessPort userAccessPort,
                             RegistryService registryService) {
        this.store = store;
        this.userAccessPort = userAccessPort;
        this.registryService = registryService;
    }

    @Override
    public UseExpResult useExp(String matchUuid, String userUuid, String stat) {
        Long userId = userUuid == null ? null
                : userAccessPort.findByUuid(userUuid).map(UserAccessPort.UserView::id).orElse(null);
        if (userId == null) {
            throw notFound();
        }
        MatchExpView match = store.findMatchByUuid(matchUuid).orElseThrow(ExperienceService::notFound);
        CharacterExpView actor = store.findCharacterByMatchAndUser(match.id(), userId)
                .orElseThrow(ExperienceService::notFound);

        if (!MatchStatuses.RUNNING.equals(match.status())) {
            throw fail(ExperienceException.Code.MATCH_NOT_RUNNING, "The match is not running");
        }
        if (match.idCharacterCurrentTurn() != null && match.idCharacterCurrentTurn() != actor.id()) {
            throw fail(ExperienceException.Code.NOT_YOUR_TURN, "It is not your character's turn");
        }
        if (actor.isComa()) {
            throw fail(ExperienceException.Code.COMA, "The character is in a coma");
        }
        if (actor.isSleeping()) {
            throw fail(ExperienceException.Code.SLEEPING, "The character is sleeping");
        }
        String token = EffectStatCodec.normalize(stat);
        if (token == null || !ExperienceCostCalculator.STATS.contains(token)) {
            throw fail(ExperienceException.Code.INVALID_STAT, "stat must be one of dex, int, cos");
        }
        int secureParam = actor.idLocation() == null || match.idStory() == null ? 0
                : store.findLocationSecureParam(match.idStory(), actor.idLocation()).orElse(0);
        if (secureParam <= 0) {
            throw fail(ExperienceException.Code.LOCATION_NOT_SAFE, "Experience can only be spent in a safe location");
        }

        ExperienceCostCalculator pricing = pricingOf(match);
        int before = current(actor, token);
        if (pricing.atCap(before)) {
            throw fail(ExperienceException.Code.MAX_STAT_VALUE, "The " + token + " is already at its maximum");
        }
        int cost = pricing.cost(before);
        if (actor.exp() < cost) {
            throw fail(ExperienceException.Code.NOT_ENOUGH_EXP,
                    "Not enough experience: " + cost + " needed, " + actor.exp() + " available");
        }

        int after = before + 1;
        int expAfter = actor.exp() - cost;
        int dex = "dex".equals(token) ? after : actor.dexterity();
        int intel = "int".equals(token) ? after : actor.intelligence();
        int cos = "cos".equals(token) ? after : actor.constitution();
        store.updateCharacter(match.id(), actor.id(), dex, intel, cos, expAfter);
        store.logExpUse(match.id(), actor.id(), match.currentClock(),
                MSG_EXP_USE + " " + token + " " + before + "->" + after + " cost " + cost);
        writeRegistry(match, actor.id(), token, after);

        return new UseExpResult(match.uuid(), actor.uuid(), token, before, after, actor.exp(), expAfter, cost,
                pricing.costs(dex, intel, cos),
                List.of(new StatChange(actor.uuid(), token, before, after, 1),
                        new StatChange(actor.uuid(), "exp", actor.exp(), expAfter, -cost)));
    }

    /**
     * v0.38.3 - the registry keys of use-exp. Only a key the story DECLARES in {@code list_keys}
     * is written: an undeclared one is skipped in silence, so a story that never asked for them
     * sees no orphan row. Each write goes through {@link RegistryService#upsert}, which is what
     * lets a mission waiting on {@code use-exp = 1} or {@code use-exp-DEX = 5} move at once.
     */
    private void writeRegistry(MatchExpView match, long idCharacter, String token, int after) {
        if (registryService == null || match.idStory() == null) {
            return;
        }
        if (registryService.isDeclared(match.idStory(), KEY_USE_EXP)) {
            int count = registryService.find(match.id(), KEY_USE_EXP).stream()
                    .mapToInt(ExperienceService::intOrZero).max().orElse(0);
            registryService.upsert(match.id(), match.idStory(), KEY_USE_EXP, String.valueOf(count + 1),
                    idCharacter, null, null, match.currentClock());
        }
        String statKey = KEY_USE_EXP_PREFIX + token.toUpperCase(Locale.ROOT);
        if (registryService.isDeclared(match.idStory(), statKey)) {
            registryService.upsert(match.id(), match.idStory(), statKey, String.valueOf(after),
                    idCharacter, null, null, match.currentClock());
        }
    }

    /** A registry value read as a counter; anything that is not a number counts as zero. */
    private static int intOrZero(String value) {
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException notNumeric) {
            return 0;
        }
    }

    private ExperienceCostCalculator pricingOf(MatchExpView match) {
        if (match.idStory() == null || match.idDifficulty() == null) {
            return new ExperienceCostCalculator(match.expCost(), 0, 0);
        }
        return store.findDifficulty(match.idStory(), match.idDifficulty())
                .map(d -> new ExperienceCostCalculator(d.expCost(), d.expCostBase(), d.maxStatValue()))
                .orElseGet(() -> new ExperienceCostCalculator(match.expCost(), 0, 0));
    }

    private static int current(CharacterExpView actor, String token) {
        return switch (token) {
            case "dex" -> actor.dexterity();
            case "int" -> actor.intelligence();
            default -> actor.constitution();
        };
    }

    private static ExperienceException notFound() {
        return new ExperienceException(ExperienceException.Code.MATCH_NOT_FOUND,
                "Match not found or not accessible");
    }

    private static ExperienceException fail(ExperienceException.Code code, String message) {
        return new ExperienceException(code, message);
    }
}
