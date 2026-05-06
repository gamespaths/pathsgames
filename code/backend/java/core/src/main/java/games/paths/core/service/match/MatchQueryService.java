package games.paths.core.service.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchEventOption;
import games.paths.core.model.match.MatchLocationState;
import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * MatchQueryService - Domain service implementing read-side match
 * operations. Step 19 — list user matches and produce {@link MatchDetail}
 * for the GET /match/{uuid}/info endpoint.
 */
public class MatchQueryService implements MatchQueryPort {

    private final MatchReadPort matchReadPort;
    private final StoryReadPort storyReadPort;
    private final UserAccessPort userAccessPort;

    public MatchQueryService(MatchReadPort matchReadPort,
                             StoryReadPort storyReadPort,
                             UserAccessPort userAccessPort) {
        this.matchReadPort = matchReadPort;
        this.storyReadPort = storyReadPort;
        this.userAccessPort = userAccessPort;
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
        List<MatchSummary> result = new ArrayList<>();
        for (GamingMatchEntity m : matches) {
            result.add(toSummary(m, user.uuid()));
        }
        return result;
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

        Optional<StoryEntity> storyOpt = storyReadPort.findAllStories().stream()
                .filter(s -> s.getId().equals(match.getIdStory()))
                .findFirst();

        MatchDetail detail = new MatchDetail();
        detail.setMatch(toSummary(match, user.uuid(), storyOpt.orElse(null), match.getIdDifficulty()));

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

        if (storyOpt.isPresent()) {
            Long startId = storyOpt.get().getIdLocationStart() != null
                    ? storyOpt.get().getIdLocationStart().longValue()
                    : null;
            if (startId != null) {
                LocationEntity start = locationsById.get(startId);
                detail.setCurrentLocationId(startId);
                if (start != null) {
                    detail.setCurrentLocationUuid(start.getUuid());
                    detail.setCurrentLocationName("location-" + start.getId());
                }
            }
        }

        // Step 19 ships the events/choices lists empty — the engine
        // populating them belongs to Step 25+ but the contract is set now.
        detail.setEvents(new ArrayList<>());
        detail.setChoices(new ArrayList<>());

        return detail;
    }

    private MatchSummary toSummary(GamingMatchEntity match, String userUuid) {
        return toSummary(match, userUuid, null, null);
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
