package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.MovementPort;
import games.paths.core.port.match.MovementStorePort;
import games.paths.core.port.match.MovementStorePort.MatchMovementView;
import games.paths.core.port.match.MovementStorePort.MoveCharacterView;
import games.paths.core.port.match.MovementStorePort.MoveLocationView;
import games.paths.core.port.match.MovementStorePort.NeighborEdge;
import games.paths.core.port.match.MovementStorePort.WeatherMoveCost;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * MovementService - single-player movement system (Step 28).
 *
 * <p>Moves the caller's active character to an adjacent location. The energy
 * paid combines the edge cost, the target location entry cost and the Step 27
 * weather modifier (different for safe vs unsafe locations):</p>
 *
 * <pre>
 * safe            = targetLocation.secureParam &gt; 0
 * weatherModifier = safe ? weather.costSafe : weather.costNotSafe
 * totalEnergyCost = edge.energyCost + target.costEnergyEnter + weatherModifier
 * </pre>
 *
 * <p>Validation order: auth → match RUNNING → caller awake → target is a neighbor
 * → registry condition → weight ≤ capacity → energy ≥ cost → location not full.
 * On success the character position and energy are persisted and a
 * {@code log_movements} row is appended.</p>
 *
 * <p>Scope (Step 28): only the move + energy. Automatic location-entry events are
 * Step 32; group/follow movement and concurrent locking are Step 67; the full
 * weight/capacity formula is Step 34 (carried weight is 0 until inventory lands).</p>
 *
 * <p>See {@code documentation_v0/Step28_MovementSystem.md}.</p>
 */
public class MovementService implements MovementPort {

    private static final String DEFAULT_LANG = "en";

    private final MovementStorePort store;
    private final UserAccessPort userAccessPort;
    private final ContentQueryPort contentQueryPort;

    public MovementService(MovementStorePort store, UserAccessPort userAccessPort) {
        this(store, userAccessPort, null);
    }

    /** Full constructor: {@code contentQueryPort} resolves the location cards (nullable). */
    public MovementService(MovementStorePort store, UserAccessPort userAccessPort,
                           ContentQueryPort contentQueryPort) {
        this.store = store;
        this.userAccessPort = userAccessPort;
        this.contentQueryPort = contentQueryPort;
    }

    @Override
    public MovementResult startMovement(String matchUuid, String userUuid, String targetLocationUuid) {
        long userId = requireUser(userUuid);
        MatchMovementView match = requireMatch(matchUuid);

        // Caller must own a character in this match (mask as not-found otherwise).
        MoveCharacterView caller = store.findCharacterByMatchAndUser(match.id(), userId)
                .orElseThrow(MovementService::notFound);

        if (!MatchStatuses.RUNNING.equals(match.status())) {
            throw new MovementException(MovementException.Code.MATCH_NOT_RUNNING,
                    "Match is not RUNNING");
        }
        if (caller.isComa()) {
            throw new MovementException(MovementException.Code.COMA,
                    "Character cannot move while in coma");
        }
        if (caller.isSleeping()) {
            throw new MovementException(MovementException.Code.SLEEPING,
                    "Character cannot move while sleeping");
        }
        if (caller.idLocation() == null) {
            throw new MovementException(MovementException.Code.NOT_A_NEIGHBOR,
                    "Character has no current location");
        }

        MoveLocationView target = store.findLocationByStoryAndUuid(match.idStory(), targetLocationUuid)
                .orElseThrow(() -> new MovementException(MovementException.Code.NOT_A_NEIGHBOR,
                        "Target location is not a neighbor"));

        NeighborEdge edge = findEdge(match.idStory(), caller.idLocation(), target.id())
                .orElseThrow(() -> new MovementException(MovementException.Code.NOT_A_NEIGHBOR,
                        "Target location is not a neighbor"));

        if (!conditionMet(match.id(), edge)) {
            throw new MovementException(MovementException.Code.MOVEMENT_CONDITION_NOT_MET,
                    "Movement condition not met: " + edge.conditionKey() + "=" + edge.conditionValue());
        }

        int totalCost = totalEnergyCost(edge.energyCost(), target, weatherCost(match.id()));

        // Step 34 owns the full weight formula; carried weight is 0 until inventory exists.
        if (caller.carriedWeight() > caller.weightMax()) {
            throw new MovementException(MovementException.Code.OVERWEIGHT,
                    "Carried weight exceeds capacity");
        }
        if (caller.energy() < totalCost) {
            throw new MovementException(MovementException.Code.INSUFFICIENT_ENERGY,
                    "Not enough energy: need " + totalCost + ", have " + caller.energy());
        }
        if (target.maxCharacters() > 0
                && store.countCharactersAtLocation(match.id(), target.id()) >= target.maxCharacters()) {
            throw new MovementException(MovementException.Code.LOCATION_FULL,
                    "Target location is at capacity");
        }

        int newEnergy = caller.energy() - totalCost;
        store.updateCharacterLocationAndEnergy(match.id(), caller.id(), target.id(), newEnergy);
        store.insertMovementLog(match.id(), caller.id(), caller.idLocation(), target.id(), totalCost);

        return new MovementResult(matchUuid, caller.uuid(),
                caller.idLocation(), null,
                target.id(), target.uuid(),
                totalCost, newEnergy, match.currentClock());
    }

    @Override
    public List<VisitedLocation> listLocations(String matchUuid, String userUuid, String lang) {
        long userId = requireUser(userUuid);
        MatchMovementView match = requireMatch(matchUuid);
        if (match.idUserCreator() != userId) {
            throw notFound();
        }
        return buildLocations(match, resolveLang(lang));
    }

    @Override
    public List<VisitedLocation> listLocationsForAdmin(String matchUuid, String lang) {
        return buildLocations(requireMatch(matchUuid), resolveLang(lang));
    }

    // ── visited locations payload ───────────────────────────────────────────

    private List<VisitedLocation> buildLocations(MatchMovementView match, String lang) {
        List<Long> visited = store.findVisitedLocationIds(match.id());
        // Fog of war (v0.28.6): a neighbor pointing at a never-visited location
        // must not expose that location's card. Fast lookup by id.
        Set<Long> visitedSet = new HashSet<>(visited);
        List<MoveCharacterView> characters = store.findCharactersByMatchId(match.id());
        WeatherMoveCost weather = weatherCost(match.id());

        List<VisitedLocation> result = new ArrayList<>();
        for (Long locId : visited) {
            MoveLocationView loc = store.findLocationByStoryAndId(match.idStory(), locId).orElse(null);
            if (loc == null) {
                continue;
            }
            int count = 0;
            for (MoveCharacterView c : characters) {
                if (c.idLocation() != null && c.idLocation() == loc.id()) {
                    count++;
                }
            }
            List<NeighborCost> neighborCosts = new ArrayList<>();
            for (NeighborEdge edge : store.findNeighborsOfLocation(match.idStory(), loc.id())) {
                // One-way links (flagBack=NO) must not be offered as a way back
                // when standing on the destination endpoint.
                if (!edge.traversableFrom(loc.id())) {
                    continue;
                }
                long otherId = otherEndpoint(edge, loc.id());
                MoveLocationView other = store.findLocationByStoryAndId(match.idStory(), otherId).orElse(null);
                if (other == null) {
                    continue;
                }
                int base = edge.energyCost();
                int entry = other.costEnergyEnter();
                int weatherMod = other.secureParam() > 0 ? weather.costSafe() : weather.costNotSafe();
                // The neighbor card is the destination LOCATION's card: hide it
                // (idCard + card null) until that location has been visited.
                boolean otherVisited = visitedSet.contains(other.id());
                Integer neighborIdCard = otherVisited ? other.idCard() : null;
                neighborCosts.add(new NeighborCost(other.id(), other.uuid(), edge.direction(),
                        neighborIdCard, resolveCard(match.idStory(), neighborIdCard, lang),
                        base, entry, weatherMod, base + entry + weatherMod,
                        conditionMet(match.id(), edge)));
            }
            result.add(new VisitedLocation(loc.id(), loc.uuid(), loc.idCard(),
                    resolveCard(match.idStory(), loc.idCard(), lang),
                    loc.secureParam() > 0, count, neighborCosts));
        }
        return result;
    }

    /** The LOCATION's card (from its idCard), localized; null-safe on port and id. */
    private CardInfo resolveCard(Long storyId, Integer idCard, String lang) {
        if (contentQueryPort == null || idCard == null) {
            return null;
        }
        return contentQueryPort.getCardByStoryIdAndCardId(storyId, idCard, lang);
    }

    private static String resolveLang(String lang) {
        return (lang == null || lang.isBlank()) ? DEFAULT_LANG : lang;
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** total = edge cost + target entry cost + weather modifier (safe/unsafe). */
    static int totalEnergyCost(int edgeCost, MoveLocationView target, WeatherMoveCost weather) {
        int weatherModifier = target.secureParam() > 0 ? weather.costSafe() : weather.costNotSafe();
        return edgeCost + target.costEnergyEnter() + weatherModifier;
    }

    private WeatherMoveCost weatherCost(long idMatch) {
        WeatherMoveCost w = store.findCurrentWeatherMoveCost(idMatch);
        return w == null ? new WeatherMoveCost(0, 0) : w;
    }

    private Optional<NeighborEdge> findEdge(long idStory, long fromLocation, long toLocation) {
        for (NeighborEdge e : store.findNeighborsOfLocation(idStory, fromLocation)) {
            // Block backward traversal of a one-way link (flagBack=NO).
            if (touches(e, fromLocation, toLocation) && e.traversableFrom(fromLocation)) {
                return Optional.of(e);
            }
        }
        return Optional.empty();
    }

    private static boolean touches(NeighborEdge e, long a, long b) {
        return (e.idLocationFrom() == a && e.idLocationTo() == b)
                || (e.idLocationFrom() == b && e.idLocationTo() == a);
    }

    private static long otherEndpoint(NeighborEdge e, long locId) {
        return e.idLocationFrom() == locId ? e.idLocationTo() : e.idLocationFrom();
    }

    private boolean conditionMet(long idMatch, NeighborEdge edge) {
        String key = edge.conditionKey();
        if (key == null || key.isBlank()) {
            return true;
        }
        String value = store.findRegistryValue(idMatch, key).orElse(null);
        return edge.conditionValue() != null && edge.conditionValue().equals(value);
    }

    private long requireUser(String userUuid) {
        return userAccessPort.findByUuid(userUuid)
                .map(UserAccessPort.UserView::id)
                .orElseThrow(MovementService::notFound);
    }

    private MatchMovementView requireMatch(String matchUuid) {
        return store.findMatchByUuid(matchUuid).orElseThrow(MovementService::notFound);
    }

    private static MovementException notFound() {
        return new MovementException(MovementException.Code.MATCH_NOT_FOUND,
                "Match not found or not accessible");
    }
}
