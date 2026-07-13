package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
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
import games.paths.core.model.match.MatchListFilter;
import games.paths.core.model.match.MatchLocationState;
import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.model.match.MatchSummaryPage;
import games.paths.core.model.match.MatchTraitCodec;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.EventExecutionPort.EventAvailability;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException.Code;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.MovementStorePort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
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
    private final MovementStorePort movementStorePort;
    private final EventExecutionStorePort eventExecutionStorePort;

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
        this(matchReadPort, storyReadPort, userAccessPort, characterReadPort, contentQueryPort, null);
    }

    /**
     * v0.28.6 — the {@code movementStorePort} provides the visited-location set
     * ({@link MovementStorePort#findVisitedLocationIds}), used to hide the card
     * of a neighbor whose destination location has never been visited (fog of
     * war). When {@code null} no gating is applied (neighbor cards fall back to
     * the location card as before).
     */
    public MatchQueryService(MatchReadPort matchReadPort,
                             StoryReadPort storyReadPort,
                             UserAccessPort userAccessPort,
                             CharacterReadPort characterReadPort,
                             ContentQueryPort contentQueryPort,
                             MovementStorePort movementStorePort) {
        this(matchReadPort, storyReadPort, userAccessPort, characterReadPort, contentQueryPort,
                movementStorePort, null);
    }

    /**
     * Step 29 — the {@code eventExecutionStorePort} loads the check context once per request so
     * every event of {@code locationsActive} can report its {@code available} flag and, when
     * blocked, the {@code reason}. The verdict comes from {@link EventAvailabilityChecker}, the
     * same one {@code execute-event} enforces, so the board and the endpoint cannot disagree.
     *
     * <p>When {@code null} (legacy constructors) every event reports
     * {@code available=false, reason=CHARACTER_CANNOT_ACT} rather than silently claiming to be
     * executable.</p>
     */
    @SuppressWarnings("java:S107")
    public MatchQueryService(MatchReadPort matchReadPort,
                             StoryReadPort storyReadPort,
                             UserAccessPort userAccessPort,
                             CharacterReadPort characterReadPort,
                             ContentQueryPort contentQueryPort,
                             MovementStorePort movementStorePort,
                             EventExecutionStorePort eventExecutionStorePort) {
        this.matchReadPort = matchReadPort;
        this.storyReadPort = storyReadPort;
        this.userAccessPort = userAccessPort;
        this.characterReadPort = characterReadPort;
        this.contentQueryPort = contentQueryPort;
        this.movementStorePort = movementStorePort;
        this.eventExecutionStorePort = eventExecutionStorePort;
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

    /** Admin-list page-size bounds (v0.28.1). */
    private static final int DEFAULT_PAGE_LIMIT = 50;
    private static final int MAX_PAGE_LIMIT = 200;

    @Override
    public MatchSummaryPage listMatchesPage(MatchListFilter filter) {
        MatchListFilter f = filter != null
                ? filter : new MatchListFilter(null, null, null, null, null, null);
        int limit = clampLimit(f.limit());

        // Resolve creator/story uuids to ids. An unknown uuid yields an empty
        // page rather than silently dropping the filter (which would leak
        // unrelated matches to the caller).
        Long idUser = null;
        if (notBlank(f.userUuid())) {
            Optional<UserAccessPort.UserView> u = userAccessPort.findByUuid(f.userUuid());
            if (u.isEmpty()) {
                return emptyPage(limit);
            }
            idUser = u.get().id();
        }
        Long idStory = null;
        if (notBlank(f.storyUuid())) {
            Optional<StoryEntity> s = storyReadPort.findStoryByUuid(f.storyUuid());
            if (s.isEmpty()) {
                return emptyPage(limit);
            }
            idStory = s.get().getId();
        }
        String tsFrom = sinceDaysToTs(f.sinceDays());
        String status = notBlank(f.status()) ? f.status() : null;

        String[] cursor = decodeCursor(f.cursor());
        String tsCursor = cursor != null ? cursor[0] : null;
        Long idCursor = cursor != null ? Long.valueOf(cursor[1]) : null;

        // Over-fetch one row to learn whether a further page exists.
        List<GamingMatchEntity> rows = matchReadPort.findMatchesPage(
                new MatchReadPort.MatchPageCriteria(
                        status, idUser, idStory, tsFrom, tsCursor, idCursor, limit + 1));

        boolean hasMore = rows.size() > limit;
        List<GamingMatchEntity> pageRows = hasMore ? rows.subList(0, limit) : rows;

        Map<Long, StoryEntity> storiesById = storiesById();
        List<MatchSummary> items = new ArrayList<>();
        for (GamingMatchEntity m : pageRows) {
            items.add(toSummary(m, null, storyOf(m, storiesById), m.getIdDifficulty()));
        }
        String nextCursor = null;
        if (hasMore && !pageRows.isEmpty()) {
            GamingMatchEntity last = pageRows.get(pageRows.size() - 1);
            nextCursor = encodeCursor(last.getTsInsert(), last.getId());
        }
        return new MatchSummaryPage(items, nextCursor, limit);
    }

    private static int clampLimit(Integer requested) {
        if (requested == null) {
            return DEFAULT_PAGE_LIMIT;
        }
        return Math.max(1, Math.min(requested, MAX_PAGE_LIMIT));
    }

    private static MatchSummaryPage emptyPage(int limit) {
        return new MatchSummaryPage(new ArrayList<>(), null, limit);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    /** sinceDays → ISO-8601 lower bound on {@code ts_insert}; null when unset/≤0. */
    private static String sinceDaysToTs(Integer sinceDays) {
        if (sinceDays == null || sinceDays <= 0) {
            return null;
        }
        return java.time.Instant.now()
                .minus(sinceDays, java.time.temporal.ChronoUnit.DAYS)
                .toString();
    }

    /** Encodes the keyset position ({@code ts_insert}|{@code id}) as an opaque token. */
    static String encodeCursor(String tsInsert, Long id) {
        if (tsInsert == null || id == null) {
            return null;
        }
        String raw = tsInsert + "|" + id;
        return java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /**
     * Decodes an opaque cursor into {@code [tsInsert, id]}. Returns {@code null}
     * for a missing or malformed token, so the query simply starts from page one
     * instead of failing.
     */
    static String[] decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            String raw = new String(java.util.Base64.getUrlDecoder().decode(cursor),
                    java.nio.charset.StandardCharsets.UTF_8);
            int sep = raw.lastIndexOf('|');
            if (sep <= 0 || sep == raw.length() - 1) {
                return null;
            }
            String idPart = raw.substring(sep + 1);
            Long.parseLong(idPart); // validate the id is numeric
            return new String[]{raw.substring(0, sep), idPart};
        } catch (IllegalArgumentException ex) {
            return null;
        }
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
    public MatchDetail getMatchInfo(String matchUuid, String userUuid, String lang) {
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
        return buildDetail(match, user.uuid(), resolveLang(lang), false);
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
        // null, consistent with the admin list (listAllMatches). The admin also
        // keeps EVERY location (no visited filter) so the console can render the
        // full gaming_state_locations runtime table; the fog-of-war gating on the
        // neighbor cards stays identical to the player view.
        return buildDetail(matchOpt.get(), null, DEFAULT_LANG, true);
    }

    /** Falls back to {@link #DEFAULT_LANG} when no/blank lang requested. */
    private static String resolveLang(String lang) {
        return (lang == null || lang.isBlank()) ? DEFAULT_LANG : lang;
    }

    /**
     * Builds the full {@link MatchDetail} for a match. Shared by the per-user
     * and the admin info endpoints.
     *
     * @param allLocations when true the {@code locations} list keeps EVERY story
     *                     location instead of only the visited ones. Set by the
     *                     admin endpoint, which needs the full runtime table.
     */
    private MatchDetail buildDetail(GamingMatchEntity match, String userCreatorUuid, String lang,
                                    boolean allLocations) {
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

        // v0.28.6 — the visited-location set (character positions ∪ movement log),
        // the same set GET /locations returns. It gates the neighbor location cards
        // below and, on the player endpoint, filters the locations list itself.
        // Null (legacy constructor, no movement store) disables both.
        Set<Long> visitedLocIds = movementStorePort != null
                ? new HashSet<>(movementStorePort.findVisitedLocationIds(match.getId()))
                : null;

        List<GamingStateLocationsEntity> states = matchReadPort.findLocationsByMatchId(match.getId());
        List<MatchLocationState> stateModels = new ArrayList<>();
        for (GamingStateLocationsEntity sl : states) {
            if (!allLocations && visitedLocIds != null
                    && !visitedLocIds.contains(sl.getIdLocation())) {
                continue;
            }
            MatchLocationState m = new MatchLocationState();
            m.setIdLocation(sl.getIdLocation());
            m.setUuid(sl.getUuid());
            m.setFlagAlreadyActived(sl.getFlagAlreadyActived());
            m.setClockCounter(sl.getClockCounter());
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
            }
        }

        // Step 19 ships the lean events/choices lists empty — the engine
        // populating them belongs to Step 25+ but the contract is set now.
        detail.setEvents(new ArrayList<>());
        detail.setChoices(new ArrayList<>());

        // Step 29 — ONE context for every event of the payload. The checker is a pure function
        // over it, so a story with fifty events costs exactly the same as a story with one.
        EventCheckContext checkCtx = loadCheckContext(match);

        // Step 27.x — enriched, player-occupied locations with card/neighbors/events.
        Long storyId = storyOpt.map(StoryEntity::getId).orElse(null);
        Integer endEventId = storyOpt.map(StoryEntity::getIdEventEndGame).orElse(null);
        detail.setLocationsActive(buildLocationsActive(
                storyId, endEventId, activeLocIds, locationsById, lang, visitedLocIds, checkCtx));

        return detail;
    }

    /**
     * The check context of the match's reference character — in single-player the only one, and
     * the creator's. Loaded once per request; null when no event store is wired.
     *
     * <p>The admin view uses the same reference character, so the console sees exactly the flags
     * the player would. Per-character availability arrives with multiplayer (Step 60+).</p>
     */
    private EventCheckContext loadCheckContext(GamingMatchEntity match) {
        if (eventExecutionStorePort == null || characterReadPort == null) {
            return null;
        }
        Long refCharacterId = null;
        for (GamingCharacterInstanceEntity c : characterReadPort.findCharactersByMatchId(match.getId())) {
            if (c.getIdUser() != null && c.getIdUser().equals(match.getIdUserCreator())) {
                refCharacterId = c.getId();
                break;
            }
        }
        return eventExecutionStorePort.loadCheckContext(match.getId(), refCharacterId);
    }

    /**
     * Builds the {@code locationsActive} list: for each location occupied by at
     * least one player, its resolved card plus the neighbor links touching it
     * (both directions) and the events specific to it — each with its own card.
     *
     * <p>Cards are memoized for the duration of the call: a location card is
     * reachable from every edge touching it (and from the location itself), so
     * without the cache the same card would be re-read from the content port
     * once per edge.</p>
     */
    @SuppressWarnings("java:S107")
    private List<LocationInfo> buildLocationsActive(Long storyId,
                                                    Integer endEventId,
                                                    Set<Long> activeLocIds,
                                                    Map<Long, LocationEntity> locationsById,
                                                    String lang,
                                                    Set<Long> visitedLocIds,
                                                    EventCheckContext checkCtx) {
        List<LocationInfo> result = new ArrayList<>();
        if (storyId == null || activeLocIds.isEmpty()) {
            return result;
        }

        List<LocationNeighborEntity> neighbors = storyReadPort.findLocationNeighborsByStoryId(storyId);
        List<EventEntity> events = storyReadPort.findEventsByStoryId(storyId);
        Map<Integer, CardInfo> cardCache = new HashMap<>();

        for (Long locId : activeLocIds) {
            LocationEntity loc = locationsById.get(locId);
            if (loc == null) {
                continue;
            }
            CardInfo locCard = resolveCard(storyId, loc.getIdCard(), lang, cardCache);

            List<LocationNeighborInfo> neighborInfos = new ArrayList<>();
            for (LocationNeighborEntity n : neighbors) {
                Long otherId = neighborOtherEndpoint(n, locId);
                if (otherId == null) {
                    continue;
                }
                // One-way link (flagBack=NO): hide it when standing on the
                // destination (idLocationTo), since you cannot go back.
                if (!neighborTraversableFrom(n, locId)) {
                    continue;
                }
                LocationEntity other = locationsById.get(otherId);
                // v0.28.6 fog of war — keep the authored LINK card (n.getIdCard),
                // but only fall back to the destination LOCATION's card when that
                // location has been visited (or when gating is unavailable).
                boolean otherVisited = visitedLocIds == null || visitedLocIds.contains(otherId);
                Integer neighborCardId = n.getIdCard() != null
                        ? n.getIdCard()
                        : (otherVisited && other != null ? other.getIdCard() : null);
                // Optional "return" card: when the link defines no idCardBack it
                // falls back to the forward card (idCard).
                Integer neighborCardBackId = n.getIdCardBack() != null
                        ? n.getIdCardBack()
                        : neighborCardId;
                Long fromId = n.getIdLocationFrom() != null ? n.getIdLocationFrom().longValue() : null;
                Long toId = n.getIdLocationTo() != null ? n.getIdLocationTo().longValue() : null;
                neighborInfos.add(new LocationNeighborInfo(
                        otherId,
                        other != null ? other.getUuid() : null,
                        n.getDirection(),
                        n.getFlagBack(),
                        n.getEnergyCost(),
                        resolveCard(storyId, neighborCardId, lang, cardCache),
                        other != null ? other.getSecureParam() : null,
                        fromId,
                        toId,
                        resolveCard(storyId, neighborCardBackId, lang, cardCache),
                        resolveLocationCard(storyId, fromId, locationsById, lang, visitedLocIds, cardCache),
                        resolveLocationCard(storyId, toId, locationsById, lang, visitedLocIds, cardCache)));
            }

            List<EventInfo> eventInfos = new ArrayList<>();
            for (EventEntity e : events) {
                if (e.getIdSpecificLocation() != null
                        && locId.equals(e.getIdSpecificLocation().longValue())) {
                    boolean endGame = endEventId != null && e.getId() != null
                            && endEventId.longValue() == e.getId();
                    // Step 29 — no port call in this loop: the context was loaded once.
                    EventAvailability av = checkCtx == null
                            ? EventAvailability.no(Code.CHARACTER_CANNOT_ACT)
                            : EventAvailabilityChecker.check(e, checkCtx);
                    eventInfos.add(new EventInfo(
                            e.getUuid(), e.getType(), endGame,
                            resolveCard(storyId, e.getIdCard(), lang, cardCache),
                            av.available(), av.reasonName(),
                            e.getCostEnery() == null ? 0 : e.getCostEnery()));
                }
            }

            result.add(new LocationInfo(
                    locId, loc.getUuid(), loc.getIdCard(), locCard, neighborInfos, eventInfos,
                    loc.getSecureParam()));
        }
        return result;
    }

    /**
     * Returns the endpoint of a neighbor link that is NOT {@code locId}, or null
     * when the link does not touch {@code locId}. Direction is preserved by the
     * caller via {@link LocationNeighborInfo#getDirection()}.
     */
    /**
     * Whether the neighbor link can be traversed from {@code locId}. Forward
     * (locId == idLocationFrom) is always allowed; backward (locId ==
     * idLocationTo) only when {@code flagBack == 1} (a two-way link).
     */
    private static boolean neighborTraversableFrom(LocationNeighborEntity n, Long locId) {
        Long from = n.getIdLocationFrom() != null ? n.getIdLocationFrom().longValue() : null;
        Long to = n.getIdLocationTo() != null ? n.getIdLocationTo().longValue() : null;
        if (locId.equals(from)) {
            return true;
        }
        return locId.equals(to) && n.getFlagBack() != null && n.getFlagBack() == 1;
    }

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

    /**
     * Resolves a card via the content port, or null when no port/idCard.
     * {@code cache} memoizes the lookup for the duration of one request (storyId
     * and lang are fixed there, so idCard alone is a sufficient key); it also
     * caches the null result of a card the story does not define.
     */
    private CardInfo resolveCard(Long storyId, Integer idCard, String lang,
                                 Map<Integer, CardInfo> cache) {
        if (contentQueryPort == null || idCard == null) {
            return null;
        }
        if (cache.containsKey(idCard)) {
            return cache.get(idCard);
        }
        CardInfo resolved = contentQueryPort.getCardByStoryIdAndCardId(storyId, idCard, lang);
        cache.put(idCard, resolved);
        return resolved;
    }

    /**
     * Resolves the card of the LOCATION sitting at one endpoint of a neighbor
     * link, gated on that location's own fog-of-war flag: null until it has been
     * visited. A null {@code visitedLocIds} disables the gating (legacy wiring).
     */
    private CardInfo resolveLocationCard(Long storyId, Long locId,
                                         Map<Long, LocationEntity> locationsById,
                                         String lang, Set<Long> visitedLocIds,
                                         Map<Integer, CardInfo> cache) {
        if (locId == null || (visitedLocIds != null && !visitedLocIds.contains(locId))) {
            return null;
        }
        LocationEntity loc = locationsById.get(locId);
        return loc != null ? resolveCard(storyId, loc.getIdCard(), lang, cache) : null;
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
