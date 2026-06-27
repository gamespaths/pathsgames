package games.paths.core.service.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.KeyEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.MatchCreateCommand;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.model.match.MatchTraitCodec;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchPersistencePort;
import games.paths.core.port.match.SystemModePort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.port.turnstile.TurnstileVerificationPort;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * MatchCommandService - Domain service implementing single-player match
 * creation. Pure-Java implementation: ports are injected via constructor.
 *
 * <p>Step 19 — see {@code documentation_v0/Step19_SinglePlayerMatchCreation.md}.</p>
 */
public class MatchCommandService implements MatchCommandPort {

    private static final java.security.SecureRandom SECURE_RNG = new java.security.SecureRandom();

    private final StoryReadPort storyReadPort;
    private final MatchPersistencePort persistencePort;
    private final UserAccessPort userAccessPort;
    private final SystemModePort systemModePort;
    private final TurnstileVerificationPort turnstilePort;

    public MatchCommandService(StoryReadPort storyReadPort,
                               MatchPersistencePort persistencePort,
                               UserAccessPort userAccessPort,
                               SystemModePort systemModePort) {
        this(storyReadPort, persistencePort, userAccessPort, systemModePort, (token, ip) -> true);
    }

    public MatchCommandService(StoryReadPort storyReadPort,
                               MatchPersistencePort persistencePort,
                               UserAccessPort userAccessPort,
                               SystemModePort systemModePort,
                               TurnstileVerificationPort turnstilePort) {
        this.storyReadPort = storyReadPort;
        this.persistencePort = persistencePort;
        this.userAccessPort = userAccessPort;
        this.systemModePort = systemModePort;
        this.turnstilePort = turnstilePort;
    }

    @Override
    public MatchSummary createMatch(MatchCreateCommand command) {
        if (command == null
                || isBlank(command.getUserUuid())
                || isBlank(command.getStoryUuid())
                || isBlank(command.getDifficultyUuid())) {
            throw new MatchCreationException(MatchCreationException.Code.INVALID_INPUT,
                    "userUuid, storyUuid and difficultyUuid are required");
        }

        if (!turnstilePort.verify(command.getTurnstileToken(), command.getRemoteIp())) {
            throw new MatchCreationException(MatchCreationException.Code.TURNSTILE_VALIDATION_FAILED,
                    "Turnstile verification failed");
        }

        if (systemModePort.isMaintenance()) {
            throw new MatchCreationException(MatchCreationException.Code.MAINTENANCE_MODE,
                    "Server is under maintenance, no new match can be created");
        }

        UserAccessPort.UserView user = userAccessPort.findByUuid(command.getUserUuid())
                .orElseThrow(() -> new MatchCreationException(
                        MatchCreationException.Code.USER_NOT_FOUND,
                        "User does not exist"));
        if (user.isBanned() || user.isBlocked()) {
            throw new MatchCreationException(MatchCreationException.Code.USER_BANNED,
                    "User is not allowed to create matches");
        }

        StoryEntity story = storyReadPort.findStoryByUuid(command.getStoryUuid())
                .orElseThrow(() -> new MatchCreationException(
                        MatchCreationException.Code.STORY_NOT_FOUND,
                        "Story not found: " + command.getStoryUuid()));

        StoryDifficultyEntity difficulty =
                storyReadPort.findDifficultyByStoryIdAndUuid(story.getId(), command.getDifficultyUuid())
                        .orElseThrow(() -> new MatchCreationException(
                                MatchCreationException.Code.DIFFICULTY_NOT_FOUND,
                                "Difficulty not found: " + command.getDifficultyUuid()));

        validateCreatorTraitSelection(story, difficulty, command);

        List<LocationEntity> locations = storyReadPort.findLocationsByStoryId(story.getId());
        if (locations == null || locations.isEmpty()) {
            throw new MatchCreationException(MatchCreationException.Code.STORY_HAS_NO_LOCATIONS,
                    "Story has no locations defined");
        }
        List<KeyEntity> keys = storyReadPort.findKeysByStoryId(story.getId());

        GamingMatchEntity match = new GamingMatchEntity();
        match.setIdStory(story.getId());
        match.setIdDifficulty(difficulty.getId());
        match.setName(command.getName());
        match.setIdUserCreator(user.id());
        match.setStatus("CREATED");
        match.setCurrentClock(0);
        match.setExpCost(difficulty.getExpCost() != null ? difficulty.getExpCost() : 5);
        match.setSecureLocationParam(0);
        match.setCounterConsecutivePass(0);
        match.setSinglePlayer(command.getSinglePlayer() != null ? command.getSinglePlayer() : 1);
        match.setCharacterTemplateUuid(command.getCharacterTemplateUuid());
        match.setClassUuid(command.getClassUuid());
        match.setTraitUuids(MatchTraitCodec.join(command.getTraitUuids()));
        // Step 27 — deterministic per-match RNG seed: honour the explicit seed
        // (Robot tests pass 42), otherwise generate a fresh random one.
        match.setRngSeed(command.getRngSeed() != null
                ? command.getRngSeed()
                : SECURE_RNG.nextLong());

        GamingMatchEntity saved = persistencePort.saveMatch(match);

        List<GamingStateLocationsEntity> stateLocations = new ArrayList<>();
        for (LocationEntity loc : locations) {
            GamingStateLocationsEntity sl = new GamingStateLocationsEntity();
            sl.setIdMatch(saved.getId());
            sl.setIdLocation(loc.getId());
            sl.setFlagAlreadyActived(0);
            sl.setClockCounter(loc.getCounterTime() != null ? loc.getCounterTime() : 0);
            stateLocations.add(sl);
        }
        persistencePort.saveLocations(stateLocations);

        List<GamingStateRegistryEntity> registryRows = new ArrayList<>();
        long nextId = 1L;
        if (keys != null) {
            for (KeyEntity k : keys) {
                GamingStateRegistryEntity r = new GamingStateRegistryEntity();
                r.setId(nextId++);
                r.setIdMatch(saved.getId());
                r.setKey(k.getName());
                applyKeyDefaultValue(r, k.getValue());
                registryRows.add(r);
            }
        }
        persistencePort.saveRegistry(registryRows);

        return toSummary(saved, story, difficulty, user.uuid());
    }

    @Override
    public UpdateOutcome updateMatch(String uuidMatch, String status, String name) {
        if (status != null && !MatchStatuses.isValid(status)) {
            return UpdateOutcome.INVALID_STATUS;
        }
        boolean found = persistencePort.updateMatchFields(uuidMatch, status, name);
        return found ? UpdateOutcome.UPDATED : UpdateOutcome.NOT_FOUND;
    }

    @Override
    public DeleteOutcome deleteMatch(String uuidMatch) {
        Optional<GamingMatchEntity> match = persistencePort.findMatchByUuid(uuidMatch);
        if (match.isEmpty()) {
            return DeleteOutcome.NOT_FOUND;
        }
        // Only a stopped (terminal) match may be deleted.
        if (!MatchStatuses.isTerminal(match.get().getStatus())) {
            return DeleteOutcome.NOT_STOPPED;
        }
        persistencePort.deleteMatchByUuid(uuidMatch);
        return DeleteOutcome.DELETED;
    }

    @Override
    public EndMatchOutcome endMatch(String uuidMatch, String uuidEvent, String userUuid) {
        if (isBlank(uuidMatch) || isBlank(uuidEvent) || isBlank(userUuid)) {
            return EndMatchOutcome.NOT_FOUND;
        }
        Optional<GamingMatchEntity> matchOpt = persistencePort.findMatchByUuid(uuidMatch);
        if (matchOpt.isEmpty()) {
            return EndMatchOutcome.NOT_FOUND;
        }
        GamingMatchEntity match = matchOpt.get();

        Optional<UserAccessPort.UserView> userOpt = userAccessPort.findByUuid(userUuid);
        if (userOpt.isEmpty() || !userOpt.get().id().equals(match.getIdUserCreator())) {
            return EndMatchOutcome.NOT_FOUND;
        }

        Optional<StoryEntity> storyOpt = storyReadPort.findStoryById(match.getIdStory());
        if (storyOpt.isEmpty() || storyOpt.get().getIdEventEndGame() == null) {
            return EndMatchOutcome.NOT_ACCEPTABLE;
        }
        StoryEntity story = storyOpt.get();

        Optional<EventEntity> eventOpt =
                storyReadPort.findEventByStoryIdAndUuid(story.getId(), uuidEvent);
        if (eventOpt.isEmpty()) {
            return EndMatchOutcome.NOT_ACCEPTABLE;
        }
        Long endGameEventId = story.getIdEventEndGame().longValue();
        if (!endGameEventId.equals(eventOpt.get().getId())) {
            return EndMatchOutcome.NOT_ACCEPTABLE;
        }

        persistencePort.updateMatchFields(uuidMatch, MatchStatuses.ENDED, null);
        return EndMatchOutcome.COMPLETED;
    }

    /**
     * Step 23 — validates the creator loadout traits against the selected
     * class and the difficulty cost budgets. The class is resolved leniently:
     * an unknown class uuid is treated as "no class", so permitted-restricted
     * traits fail with TRAIT_NOT_COMPATIBLE.
     */
    private void validateCreatorTraitSelection(StoryEntity story,
                                               StoryDifficultyEntity difficulty,
                                               MatchCreateCommand command) {
        ClassEntity clazz = null;
        if (!isBlank(command.getClassUuid())) {
            clazz = storyReadPort.findClassByStoryIdAndUuid(story.getId(), command.getClassUuid())
                    .orElse(null);
        }
        try {
            TraitSelectionValidator.resolveAndValidate(
                    storyReadPort, story.getId(), clazz, difficulty, command.getTraitUuids());
        } catch (TraitSelectionValidator.TraitSelectionException ex) {
            throw new MatchCreationException(
                    MatchCreationException.Code.valueOf(ex.getViolation().name()), ex.getMessage());
        }
    }

    private void applyKeyDefaultValue(GamingStateRegistryEntity r, String rawValue) {
        if (rawValue == null) {
            return;
        }
        String trimmed = rawValue.trim();
        if (trimmed.isEmpty()) {
            r.setStringValue("");
            return;
        }
        try {
            r.setIntValue(Integer.parseInt(trimmed));
        } catch (NumberFormatException ex) {
            r.setStringValue(trimmed);
        }
    }

    private MatchSummary toSummary(GamingMatchEntity match, StoryEntity story,
                                   StoryDifficultyEntity difficulty, String userUuid) {
        MatchSummary s = new MatchSummary();
        s.setUuid(match.getUuid());
        s.setStoryUuid(story.getUuid());
        s.setDifficultyUuid(difficulty.getUuid());
        s.setName(match.getName());
        s.setStatus(match.getStatus());
        s.setCurrentClock(match.getCurrentClock());
        s.setExpCost(match.getExpCost());
        s.setUserCreatorUuid(userUuid);
        s.setTsInsert(match.getTsInsert());
        s.setSinglePlayer(match.getSinglePlayer());
        s.setCharacterTemplateUuid(match.getCharacterTemplateUuid());
        s.setClassUuid(match.getClassUuid());
        s.setTraitUuids(MatchTraitCodec.split(match.getTraitUuids()));
        return s;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /**
     * Helper for test seams - not used in production code paths.
     */
    Optional<StoryEntity> resolveStoryForTesting(String storyUuid) {
        return storyReadPort.findStoryByUuid(storyUuid);
    }
}
