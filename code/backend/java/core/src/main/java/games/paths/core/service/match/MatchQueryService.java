package games.paths.core.service.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.LocationNeighborEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.EventInfo;
import games.paths.core.model.match.LocationInfo;
import games.paths.core.model.match.LocationNeighborInfo;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchEventOption;
import games.paths.core.model.match.MatchLocationState;
import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.model.match.MatchTraitCodec;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * MatchQueryService - Domain service implementing read-side match
 * operations. Step 19 — list user matches and produce {@link MatchDetail}
 * for the GET /match/{uuid}/info endpoint.
 */
public class MatchQueryService implements MatchQueryPort {

    /** Default language for card text resolution (the info endpoint carries no lang). */
    private static final String DEFAULT_LANG = "en";

    private final MatchReadPort matchReadPort;
    private final StoryReadPort storyReadPort;
    private final UserAccessPort userAccessPort;
    private final CharacterReadPort characterReadPort;
    private final ContentQueryPort contentQueryPort;

    public MatchQueryService(MatchReadPort matchReadPort,
                             StoryReadPort storyReadPort,
                             UserAccessPort userAccessPort) {
        this(matchReadPort, storyReadPort, userAccessPort, null);
    }

    /**
     * Step 21 — the {@code characterReadPort} lets {@link #getMatchInfo} and
     * {@link #getMatchInfoForAdmin} populate the {@code players} list of the
     * returned {@link MatchDetail}. When {@code null} the players list stays empty.
     */
    public MatchQueryService(MatchReadPort matchReadPort,
                             StoryReadPort storyReadPort,
                             UserAccessPort userAccessPort,
                             CharacterReadPort characterReadPort) {
        this(matchReadPort, storyReadPort, userAccessPort, characterReadPort, null);
    }

    /**
     * Step 27.x — the {@code contentQueryPort} resolves the visual cards for the
     * enriched {@code locationsActive} payload (location, neighbor and event
     * cards). When {@code null} the cards are left null but the structure is
     * still produced.
     */
    public MatchQueryService(MatchReadPort matchReadPort,
                             StoryReadPort storyReadPort,
                             UserAccessPort userAccessPort,
                             CharacterReadPort characterReadPort,
                             ContentQueryPort contentQueryPort) {
        this.matchReadPort = matchReadPort;
        this.storyReadPort = storyReadPort;
        this.userAccessPort = userAccessPort;
        this.characterReadPort = characterReadPort;
        this.contentQueryPort = contentQueryPort;
    }

    @Override
    public List<MatchSummary> listUserMatches(String userUuid) {
        if (userUuid == null || userUuid.isBlank()) {
            return new ArrayList<>();
        }
        Optional<UserAccessPort.UserView> userOpt = userAccessPort.findByUuid(userUuid);
        if (userOpt.isEmpty()) {
            return new ArrayList<>();
        }
        UserAccessPort.UserView user = userOpt.get();

        List<GamingMatchEntity> matches = matchReadPort.findMatchesByUserId(user.id());
        Map<Long, StoryEntity> storiesById = storiesById();
        List<MatchSummary> result = new ArrayList<>();
        for (GamingMatchEntity m : matches) {
            result.add(toSummary(m, user.uuid(), storyOf(m, storiesById), m.getIdDifficulty()));
        }
        return result;
    }

    @Override
    public List<MatchSummary> listAllMatches() {
        List<GamingMatchEntity> matches = matchReadPort.findAllMatches();
        Map<Long, StoryEntity> storiesById = storiesById();
        List<MatchSummary> result = new ArrayList<>();
        for (GamingMatchEntity m : matches) {
            result.add(toSummary(m, null, storyOf(m, storiesById), m.getIdDifficulty()));
        }
        return result;
    }

    /** Index all stories by id once, so a list of matches doesn't re-scan per row. */
    private Map<Long, StoryEntity> storiesById() {
        Map<Long, StoryEntity> byId = new HashMap<>();
        for (StoryEntity s : storyReadPort.findAllStories()) {
            byId.put(s.getId(), s);
        }
        return byId;
    }

    private StoryEntity storyOf(GamingMatchEntity match, Map<Long, StoryEntity> storiesById) {
        return match.getIdStory() != null ? storiesById.get(match.getIdStory()) : null;
    }

    @Override
    public MatchDetail getMatchInfo(String matchUuid, String userUuid) {
        if (matchUuid == null || matchUuid.isBlank() || userUuid == null || userUuid.isBlank()) {
            return null;
        }
        Optional<UserAccessPort.UserView> userOpt = userAccessPort.findByUuid(userUuid);
        if (userOpt.isEmpty()) {
            return null;
        }
        UserAccessPort.UserView user = userOpt.get();

        Optional<GamingMatchEntity> matchOpt = matchReadPort.findMatchByUuid(matchUuid);
        if (matchOpt.isEmpty()) {
            return null;
        }
        GamingMatchEntity match = matchOpt.get();
        if (!match.getIdUserCreator().equals(user.id())) {
            return null;
        }
        return buildDetail(match, user.uuid());
    }

    @Override
    public MatchDetail getMatchInfoForAdmin(String matchUuid) {
        if (matchUuid == null || matchUuid.isBlank()) {
            return null;
        }
        Optional<GamingMatchEntity> matchOpt = matchReadPort.findMatchByUuid(matchUuid);
        if (matchOpt.isEmpty()) {
            return null;
        }
        // Admin view — no per-user ownership check. userCreatorUuid is left
        // null, consistent with the admin list (listAllMatches).
        return buildDetail(matchOpt.get(), null);
    }

    /**
     * Builds the full {@link MatchDetail} for a match. Shared by the per-user
     * and the admin info endpoints.
     */
    private MatchDetail buildDetail(GamingMatchEntity match, String userCreatorUuid) {
        Optional<StoryEntity> storyOpt = storyReadPort.findAllStories().stream()
                .filter(s -> s.getId().equals(match.getIdStory()))
                .findFirst();

        MatchDetail detail = new MatchDetail();
        detail.setMatch(toSummary(match, userCreatorUuid, storyOpt.orElse(null), match.getIdDifficulty()));

        List<LocationEntity> storyLocations = storyOpt.isPresent()
                ? storyReadPort.findLocationsByStoryId(storyOpt.get().getId())
                : List.of();
        Map<Long, LocationEntity> locationsById = new HashMap<>();
        for (LocationEntity l : storyLocations) {
            locationsById.put(l.getId(), l);
        }

        List<GamingStateLocationsEntity> states = matchReadPort.findLocationsByMatchId(match.getId());
        List<MatchLocationState> stateModels = new ArrayList<>();
        for (GamingStateLocationsEntity sl : states) {
            MatchLocationState m = new MatchLocationState();
            m.setIdLocation(sl.getIdLocation());
            m.setUuid(sl.getUuid());
            m.setFlagAlreadyActived(sl.getFlagAlreadyActived());
            m.setClockCounter(sl.getClockCounter());
            LocationEntity le = locationsById.get(sl.getIdLocation());
            if (le != null) {
                m.setName("location-" + le.getId());
            }
            stateModels.add(m);
        }
        detail.setLocations(stateModels);

        List<GamingStateRegistryEntity> regRows = matchReadPort.findRegistryByMatchId(match.getId());
        List<MatchRegistryEntry> regModels = new ArrayList<>();
        for (GamingStateRegistryEntity r : regRows) {
            MatchRegistryEntry e = new MatchRegistryEntry();
            e.setUuid(r.getUuid());
            e.setKey(r.getKey());
            e.setStringValue(r.getStringValue());
            e.setIntValue(r.getIntValue());
            regModels.add(e);
        }
        detail.setRegistry(regModels);

        // Step 21 — populate the players/characters of the match (empty when no
        // character read port is wired, e.g. in the legacy 3-arg constructor).
        List<CharacterInstanceInfo> players = new ArrayList<>();
        if (characterReadPort != null) {
            Long requesterId = userCreatorUuid != null ? match.getIdUserCreator() : null;
            players = CharacterMapper.buildAll(
                    characterReadPort.findCharactersByMatchId(match.getId()),
                    match, storyReadPort, characterReadPort, userCreatorUuid, requesterId);
        }
        detail.setPlayers(players);

        // Locations currently occupied by one or more players (insertion-ordered).
        Set<Long> activeLocIds = new LinkedHashSet<>();
        for (CharacterInstanceInfo p : players) {
            if (p.getIdLocation() != null) {
                activeLocIds.add(p.getIdLocation());
            }
        }

        // Current location now reflects where the player actually is; fall back to
        // the story start location when no player/idLocation is available.
        Long currentLocId = activeLocIds.isEmpty() ? null : activeLocIds.iterator().next();
        if (currentLocId == null && storyOpt.isPresent()
                && storyOpt.get().getIdLocationStart() != null) {
            currentLocId = storyOpt.get().getIdLocationStart().longValue();
        }
        if (currentLocId != null) {
            LocationEntity current = locationsById.get(currentLocId);
            detail.setCurrentLocationId(currentLocId);
            if (current != null) {
                detail.setCurrentLocationUuid(current.getUuid());
                detail.setCurrentLocationName("location-" + current.getId());
            }
        }

        // Step 19 ships the lean events/choices lists empty — the engine
        // populating them belongs to Step 25+ but the contract is set now.
        detail.setEvents(new ArrayList<>());
        detail.setChoices(new ArrayList<>());

        // Step 27.x — enriched, player-occupied locations with card/neighbors/events.
        Long storyId = storyOpt.map(StoryEntity::getId).orElse(null);
        Integer endEventId = storyOpt.map(StoryEntity::getIdEventEndGame).orElse(null);
        detail.setLocationsActive(
                buildLocationsActive(storyId, endEventId, activeLocIds, locationsById));

        return detail;
    }

    /**
     * Builds the {@code locationsActive} list: for each location occupied by at
     * least one player, its resolved card plus the neighbor links touching it
     * (both directions) and the events specific to it — each with its own card.
     */
    private List<LocationInfo> buildLocationsActive(Long storyId,
                                                    Integer endEventId,
                                                    Set<Long> activeLocIds,
                                                    Map<Long, LocationEntity> locationsById) {
        List<LocationInfo> result = new ArrayList<>();
        if (storyId == null || activeLocIds.isEmpty()) {
            return result;
        }

        List<LocationNeighborEntity> neighbors = storyReadPort.findLocationNeighborsByStoryId(storyId);
        List<EventEntity> events = storyReadPort.findEventsByStoryId(storyId);

        for (Long locId : activeLocIds) {
            LocationEntity loc = locationsById.get(locId);
            if (loc == null) {
                continue;
            }
            CardInfo locCard = resolveCard(storyId, loc.getIdCard());

            List<LocationNeighborInfo> neighborInfos = new ArrayList<>();
            for (LocationNeighborEntity n : neighbors) {
                Long otherId = neighborOtherEndpoint(n, locId);
                if (otherId == null) {
                    continue;
                }
                LocationEntity other = locationsById.get(otherId);
                Integer neighborCardId = n.getIdCard() != null
                        ? n.getIdCard()
                        : (other != null ? other.getIdCard() : null);
                neighborInfos.add(new LocationNeighborInfo(
                        otherId,
                        other != null ? other.getUuid() : null,
                        n.getDirection(),
                        n.getFlagBack(),
                        n.getEnergyCost(),
                        resolveCard(storyId, neighborCardId)));
            }

            List<EventInfo> eventInfos = new ArrayList<>();
            for (EventEntity e : events) {
                if (e.getIdSpecificLocation() != null
                        && locId.equals(e.getIdSpecificLocation().longValue())) {
                    boolean endGame = endEventId != null && e.getId() != null
                            && endEventId.longValue() == e.getId();
                    eventInfos.add(new EventInfo(
                            e.getUuid(), e.getType(), endGame, resolveCard(storyId, e.getIdCard())));
                }
            }

            result.add(new LocationInfo(
                    locId, loc.getUuid(), locCard, neighborInfos, eventInfos));
        }
        return result;
    }

    /**
     * Returns the endpoint of a neighbor link that is NOT {@code locId}, or null
     * when the link does not touch {@code locId}. Direction is preserved by the
     * caller via {@link LocationNeighborInfo#getDirection()}.
     */
    private static Long neighborOtherEndpoint(LocationNeighborEntity n, Long locId) {
        Long from = n.getIdLocationFrom() != null ? n.getIdLocationFrom().longValue() : null;
        Long to = n.getIdLocationTo() != null ? n.getIdLocationTo().longValue() : null;
        if (locId.equals(from)) {
            return to;
        }
        if (locId.equals(to)) {
            return from;
        }
        return null;
    }

    /** Resolves a card via the content port, or null when no port/idCard. */
    private CardInfo resolveCard(Long storyId, Integer idCard) {
        if (contentQueryPort == null || idCard == null) {
            return null;
        }
        return contentQueryPort.getCardByStoryIdAndCardId(storyId, idCard, DEFAULT_LANG);
    }

    private MatchSummary toSummary(GamingMatchEntity match, String userUuid,
                                   StoryEntity story, Long difficultyId) {
        MatchSummary s = new MatchSummary();
        s.setUuid(match.getUuid());
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
        if (story != null) {
            s.setStoryUuid(story.getUuid());
            Optional<StoryDifficultyEntity> diff = storyReadPort
                    .findDifficultiesByStoryId(story.getId()).stream()
                    .filter(d -> d.getId().equals(difficultyId != null ? difficultyId : match.getIdDifficulty()))
                    .findFirst();
            diff.ifPresent(d -> s.setDifficultyUuid(d.getUuid()));
        }
        // The events/options collections are exposed via {@link MatchDetail}
        // and not on the summary.
        ignoreUnused();
        return s;
    }

    private void ignoreUnused() {
        MatchEventOption.class.getSimpleName(); // referenced by MatchDetail consumers
    }
}
