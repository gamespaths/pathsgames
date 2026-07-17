package games.paths.core.service.match;

import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.EventExecutionStorePort.CharacterStats;
import games.paths.core.port.match.EventExecutionStorePort.EventActorView;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.EventExecutionStorePort.MatchEventView;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * EventExecutionService - normal (player-triggered) events (Step 29).
 *
 * <p>Executes a NORMAL or ONCE event for the caller's character: the event is checked by
 * {@link EventAvailabilityChecker} (the same verdict {@code /info} publishes as
 * {@code available}), its energy and coin cost is paid once, then the whole
 * {@code id_event_next} chain applies its effects.</p>
 *
 * <p>Rules worth stating, because they are easy to get wrong:</p>
 * <ul>
 *   <li><b>Turns are untouched.</b> No turn is required and none is consumed — same as Step
 *       28 movement. {@code turnConsumed} is always false; Step 61 revisits this.</li>
 *   <li><b>Chained events are consequences, not choices.</b> They are not re-checked and
 *       cost nothing: the player already paid to start the chain. The single exception is
 *       the ONCE invariant, which is a data rule rather than an eligibility one.</li>
 *   <li><b>Coma short-circuits everything.</b> When life reaches zero the chain stops and
 *       {@code flag_end_time} does not fire: Step 29 only raises the flags, Step 38 owns
 *       the consequences.</li>
 *   <li><b>{@code gameOver} is only a flag.</b> Moving the match to GAMEOVER is Step 38.</li>
 *   <li><b>Forced movement bypasses Step 28.</b> An effect's {@code id_location} (v0.29.3)
 *       moves its recipients with no neighbor, energy or availability check; only a cost-0
 *       movement log row is written per moved character.</li>
 * </ul>
 *
 * <p>See {@code documentation_v0/Step29_NormalEvents.md}.</p>
 */
public class EventExecutionService implements EventExecutionPort {

    private static final String DEFAULT_LANG = "en";
    private static final String ADD = "ADD";
    private static final String REMOVE = "REMOVE";
    private static final String TARGET_ONLY_ONE = "ONLY_ONE";

    /**
     * A chain longer than this is treated as broken and simply stops.
     *
     * <p>The Step 22 validator rejects cycles at import, but the admin CRUD path is lenient
     * and never sees the whole graph, so an authored {@code A → B → A} can reach the engine.
     * The visited set already breaks such a loop; this is the belt to its braces.</p>
     */
    private static final int MAX_CHAIN = 32;

    private final EventExecutionStorePort store;
    private final UserAccessPort userAccessPort;
    private final ContentQueryPort contentQueryPort;
    private final TimeAdvancementService timeAdvancementService;

    public EventExecutionService(EventExecutionStorePort store,
                                 UserAccessPort userAccessPort,
                                 ContentQueryPort contentQueryPort,
                                 TimeAdvancementService timeAdvancementService) {
        this.store = store;
        this.userAccessPort = userAccessPort;
        this.contentQueryPort = contentQueryPort;
        this.timeAdvancementService = timeAdvancementService;
    }

    @Override
    public EventExecutionResult executeEvent(String matchUuid, String userUuid,
                                             String eventUuid, String lang) {
        long userId = requireUser(userUuid);
        MatchEventView match = requireMatch(matchUuid);

        // The caller must own a character in this match (masked as not-found otherwise).
        EventActorView actor = store.findCharacterByMatchAndUser(match.id(), userId)
                .orElseThrow(EventExecutionService::notFound);

        if (!MatchStatuses.RUNNING.equals(match.status())) {
            throw new EventExecutionException(EventExecutionException.Code.MATCH_NOT_RUNNING,
                    "Match is not RUNNING");
        }

        EventEntity event = store.findEventByStoryAndUuid(match.idStory(), eventUuid)
                .orElseThrow(() -> new EventExecutionException(
                        EventExecutionException.Code.EVENT_NOT_FOUND,
                        "Event not found in this story"));

        EventCheckContext ctx = store.loadCheckContext(match.id(), actor.id());
        EventAvailability verdict = EventAvailabilityChecker.check(event, ctx);
        if (!verdict.available()) {
            throw new EventExecutionException(verdict.reason(),
                    "Event cannot be executed: " + verdict.reasonName());
        }

        Exec x = new Exec(match, actor, ctx, resolveLang(lang), event);
        deductCosts(x, event);
        runChain(x, event);
        if (x.endTime && !x.comaTriggered) {
            forceTimeEnd(x);
        }
        return buildResult(x);
    }

    // ── costs ───────────────────────────────────────────────────────────────

    /**
     * Energy and coins are paid once, by the actor, for the event they asked for. The check
     * procedure already proved they can afford it, so neither can go negative.
     */
    private void deductCosts(Exec x, EventEntity event) {
        x.energySpent = nz(event.getCostEnery());
        x.coinSpent = nz(event.getCoinCost());
        if (x.energySpent > 0) {
            Live actor = x.live(x.actor);
            actor.energy = TimeStartRecoveryService.clamp(actor.energy - x.energySpent, 0, actor.energyMax);
        }
        if (x.coinSpent > 0) {
            Live actor = x.live(x.actor);
            actor.coin = Math.max(0, actor.coin - x.coinSpent);
            actor.backpackDirty = true;
        }
    }

    // ── the chain ───────────────────────────────────────────────────────────

    private void runChain(Exec x, EventEntity first) {
        Map<Long, EventEntity> eventsById = store.findEventsById(x.match.idStory());
        Map<Long, List<EventEffectEntity>> effectsByEvent = store.findEffectsByEventId(x.match.idStory());
        Long endGameId = store.findIdEventEndGame(x.match.idStory()).orElse(null);

        EventEntity current = first;
        while (current != null) {
            applyEvent(x, current, effectsByEvent, endGameId);
            if (x.comaTriggered) {
                return; // coma stops the chain, and flag_end_time with it
            }
            Integer next = current.getIdEventNext();
            if (next == null || next <= 0) {
                return;
            }
            long nextId = next.longValue();
            if (x.visited.contains(nextId) || x.visited.size() >= MAX_CHAIN) {
                return; // authored loop, or a chain long enough to be a bug
            }
            EventEntity nextEvent = eventsById.get(nextId);
            if (nextEvent == null) {
                return; // dangling idEventNext
            }
            if (EventAvailabilityChecker.TYPE_ONCE.equalsIgnoreCase(nextEvent.getType())
                    && x.ctx.consumedEventIds().contains(nextId)) {
                return; // a spent ONCE event stays spent, even mid-chain
            }
            current = nextEvent;
        }
    }

    /** Apply one event of the chain: its effects, then the coma check, the flags and the log. */
    private void applyEvent(Exec x, EventEntity event,
                            Map<Long, List<EventEffectEntity>> effectsByEvent, Long endGameId) {
        long eventId = event.getId() == null ? 0L : event.getId();
        x.visited.add(eventId);
        x.ctx.consumedEventIds().add(eventId);
        x.executedEventUuids.add(event.getUuid());

        for (EventEffectEntity effect : effectsByEvent.getOrDefault(eventId, List.of())) {
            applyEffect(x, event, effect);
        }

        x.endTime = x.endTime || nz(event.getFlagEndTime()) == 1;
        x.gameOver = x.gameOver || (endGameId != null && endGameId == eventId);

        checkComa(x);
        store.logEventExecuted(x.match.id(), x.actor.id(), eventId, x.currentClock,
                EventExecutionStorePort.MSG_EVENT_EXECUTED + " " + eventId);
    }

    // ── effects ─────────────────────────────────────────────────────────────

    private void applyEffect(Exec x, EventEntity event, EventEffectEntity effect) {
        List<EventActorView> recipients = resolveRecipients(x, effect);

        // Weather is a property of the MATCH, not of a character: it applies once per effect
        // row no matter how many (or how few) characters that row targets.
        if (effect.getIdWeather() != null && effect.getIdWeather() > 0) {
            store.setCurrentWeather(x.match.id(), effect.getIdWeather().longValue());
            x.weatherApplied = true;
        }

        List<String> touched = new ArrayList<>();
        for (EventActorView recipient : recipients) {
            touched.add(recipient.uuid());
            applyStatEffect(x, recipient, effect);
            applyItemEffect(x, recipient, effect);
            applyTraitEffects(x, recipient, effect, event);
            applyCharacteristicEffects(x, recipient, effect);
            applyRegistryEffect(x, recipient, effect, event);
            applyMovementEffect(x, recipient, effect);
        }

        x.effects.add(new AppliedEffect(event.getUuid(), effect.getUuid(),
                effect.getStatistics(), effect.getValue(), effect.getTarget(),
                effect.getTargetClass(), touched,
                resolveCard(x, effect.getIdCard())));
    }

    /**
     * INV-27: {@code ALL} means every character standing in the actor's location, not every
     * character of the match. {@code target_class} then narrows that set; matching nobody is
     * legal and simply applies nothing.
     */
    private List<EventActorView> resolveRecipients(Exec x, EventEffectEntity effect) {
        String target = effect.getTarget() == null ? "ALL" : effect.getTarget().trim().toUpperCase();
        List<EventActorView> base = new ArrayList<>();
        // Locations come from the tracked map, not the views: a forced movement earlier in
        // the chain must be seen by the effects that follow it.
        Long actorLocation = x.locationOf(x.actor);
        if (TARGET_ONLY_ONE.equals(target) || actorLocation == null) {
            base.add(x.actor);
        } else {
            for (EventActorView c : x.allCharacters()) {
                if (actorLocation.equals(x.locationOf(c))) {
                    base.add(c);
                }
            }
        }
        Integer targetClass = effect.getTargetClass();
        if (targetClass == null || targetClass <= 0) {
            return base;
        }
        List<EventActorView> narrowed = new ArrayList<>();
        for (EventActorView c : base) {
            if (Long.valueOf(targetClass.longValue()).equals(c.idClass())) {
                narrowed.add(c);
            }
        }
        return narrowed;
    }

    /** life/energy/sad/dex/int/cos/exp on the character; food/magic/coin on the backpack. */
    private void applyStatEffect(Exec x, EventActorView recipient, EventEffectEntity effect) {
        String stat = effect.getStatistics();
        if (stat == null || stat.isBlank()) {
            return;
        }
        int delta = nz(effect.getValue());
        Live c = x.live(recipient);
        int before;
        int after;
        switch (stat.trim().toLowerCase()) {
            case "life" -> {
                before = c.life;
                c.life = TimeStartRecoveryService.clamp(c.life + delta, 0, c.lifeMax);
                after = c.life;
            }
            case "energy" -> {
                before = c.energy;
                c.energy = TimeStartRecoveryService.clamp(c.energy + delta, 0, c.energyMax);
                after = c.energy;
            }
            case "sad" -> {
                before = c.sad;
                c.sad = TimeStartRecoveryService.clamp(c.sad + delta, 0, c.sadMax);
                after = c.sad;
            }
            case "exp" -> {
                before = c.exp;
                c.exp = Math.max(0, c.exp + delta);
                after = c.exp;
            }
            case "dex" -> {
                before = c.dexterity;
                c.dexterity = Math.max(0, c.dexterity + delta);
                after = c.dexterity;
            }
            case "int" -> {
                before = c.intelligence;
                c.intelligence = Math.max(0, c.intelligence + delta);
                after = c.intelligence;
            }
            case "cos" -> {
                before = c.constitution;
                c.constitution = Math.max(0, c.constitution + delta);
                after = c.constitution;
            }
            case "food" -> {
                before = c.food;
                c.food = Math.max(0, c.food + delta);
                after = c.food;
                c.backpackDirty = true;
            }
            case "magic" -> {
                before = c.magic;
                c.magic = Math.max(0, c.magic + delta);
                after = c.magic;
                c.backpackDirty = true;
            }
            case "coin" -> {
                before = c.coin;
                c.coin = Math.max(0, c.coin + delta);
                after = c.coin;
                c.backpackDirty = true;
            }
            default -> {
                return; // an unknown statistic is authored noise, not an error
            }
        }
        x.statChanges.add(new StatChange(recipient.uuid(), stat.trim().toLowerCase(),
                before, after, after - before));
    }

    private void applyItemEffect(Exec x, EventActorView recipient, EventEffectEntity effect) {
        Integer idItem = effect.getIdItemTarget();
        String action = effect.getItemAction();
        if (idItem == null || idItem <= 0 || action == null) {
            return;
        }
        long itemId = idItem.longValue();
        String itemUuid = x.itemUuids().get(itemId);
        if (ADD.equalsIgnoreCase(action.trim())) {
            store.addItem(x.match.id(), recipient.id(), itemId);
            x.itemAdded = true;
            x.itemChanges.add(new ItemChange(recipient.uuid(), itemUuid, ADD));
            if (recipient.id() == x.actor.id()) {
                x.ctx.ownedItemIds().add(itemId);
            }
        } else if (REMOVE.equalsIgnoreCase(action.trim())
                && store.removeItem(x.match.id(), recipient.id(), itemId)) {
            x.itemRemoved = true;
            x.itemChanges.add(new ItemChange(recipient.uuid(), itemUuid, REMOVE));
            if (recipient.id() == x.actor.id()) {
                x.ctx.ownedItemIds().remove(itemId);
            }
        }
    }

    private void applyTraitEffects(Exec x, EventActorView recipient, EventEffectEntity effect,
                                   EventEntity event) {
        Long idEvent = event.getId();
        for (long idTrait : csvIds(effect.getTraitsToAdd())) {
            if (store.addTrait(x.match.id(), recipient.id(), idTrait, idEvent)) {
                x.traitChanges.add(new TraitChange(recipient.uuid(), x.traitUuids().get(idTrait), ADD));
            }
        }
        for (long idTrait : csvIds(effect.getTraitsToRemove())) {
            if (store.removeTrait(x.match.id(), recipient.id(), idTrait)) {
                x.traitChanges.add(new TraitChange(recipient.uuid(), x.traitUuids().get(idTrait), REMOVE));
            }
        }
    }

    private void applyCharacteristicEffects(Exec x, EventActorView recipient, EventEffectEntity effect) {
        String add = effect.getCharacteristicToAdd();
        String remove = effect.getCharacteristicToRemove();
        if (blank(add) && blank(remove)) {
            return;
        }
        Live c = x.live(recipient);
        for (String v : csv(add)) {
            if (c.characteristics.add(v)) {
                x.characteristicChanges.add(new CharacteristicChange(recipient.uuid(), v, ADD));
                c.characteristicsDirty = true;
            }
        }
        for (String v : csv(remove)) {
            if (c.characteristics.remove(v)) {
                x.characteristicChanges.add(new CharacteristicChange(recipient.uuid(), v, REMOVE));
                c.characteristicsDirty = true;
            }
        }
    }

    /**
     * The registry is match-scoped, so it is written once per effect row (by the actor),
     * not once per recipient. The in-memory context is updated too, so a later event in the
     * same chain sees the value its predecessor just wrote.
     */
    private void applyRegistryEffect(Exec x, EventActorView recipient, EventEffectEntity effect,
                                     EventEntity event) {
        String key = effect.getKeyToAdd();
        if (blank(key) || recipient.id() != x.actor.id()) {
            return;
        }
        String value = effect.getKeyValueToAdd();
        String old = x.ctx.registry().get(key);
        store.upsertRegistry(x.match.id(), key, value, x.actor.id(), event.getId(), x.currentClock);
        x.ctx.registry().put(key, value);
        x.registryChanges.add(new RegistryChange(key, old, value));
    }

    /**
     * v0.29.3 forced movement: the recipient is moved to {@code id_location}, skipping the
     * whole Step 28 procedure — no neighbor check, no energy cost, no availability verdict.
     * An id that matches no location of the story is authored noise and is skipped; so is a
     * move to the location the recipient already stands in. The tracked position is updated,
     * so a later effect of the same chain resolves {@code target=ALL} where the recipient
     * now stands.
     */
    private void applyMovementEffect(Exec x, EventActorView recipient, EventEffectEntity effect) {
        Integer idLocation = effect.getIdLocation();
        if (idLocation == null || idLocation <= 0) {
            return;
        }
        long target = idLocation.longValue();
        String targetUuid = x.locationUuids().get(target);
        if (targetUuid == null) {
            return; // authored noise, not an error
        }
        Long from = x.locationOf(recipient);
        if (from != null && from == target) {
            return; // already there: nothing to move, nothing to log
        }
        store.updateCharacterLocation(x.match.id(), recipient.id(), target);
        store.insertMovementLog(x.match.id(), recipient.id(), from, target, 0);
        x.setLocation(recipient.id(), target);
        x.movementApplied = true;
        x.locationChanges.add(new LocationChange(recipient.uuid(),
                from == null ? null : x.locationUuids().get(from), targetUuid));
    }

    // ── coma & time-end ─────────────────────────────────────────────────────

    /**
     * Step 29 only raises the flags: life at zero sets {@code is_coma} and {@code is_sleeping}
     * and returns. Rescue, group coma and game over are Step 38.
     */
    private void checkComa(Exec x) {
        for (Live c : x.living.values()) {
            if (c.life <= 0 && !c.comaSet) {
                c.comaSet = true;
                store.setCharacterComa(x.match.id(), c.id);
                if (c.id == x.actor.id()) {
                    x.comaTriggered = true;
                    x.forcedSleep = true;
                }
            }
        }
    }

    private void forceTimeEnd(Exec x) {
        if (timeAdvancementService == null) {
            return;
        }
        // The Step 26 recovery reads the character rows, so this event's effects must already
        // be on disk. flush() also latches x.flushed, which stops buildResult from writing the
        // now-stale in-memory copy back over what the recovery just computed.
        flush(x);
        TimeAdvancementService.TimeEndOutcome outcome =
                timeAdvancementService.forceTimeEnd(x.match.uuid());
        x.timeEnded = true;
        x.forcedSleep = true;
        x.currentClock = outcome.newClock();
        x.refreshActorAfterTimeEnd();
    }

    // ── persistence & result ────────────────────────────────────────────────

    /** Write back every character the event touched. Called once, at the end. */
    private void flush(Exec x) {
        if (x.flushed) {
            return;
        }
        x.flushed = true;
        for (Live c : x.living.values()) {
            store.updateCharacterStats(x.match.id(), c.id, new CharacterStats(
                    c.dexterity, c.intelligence, c.constitution, c.energy, c.life, c.sad, c.exp));
            if (c.backpackDirty) {
                store.updateBackpack(x.match.id(), c.id, new BackpackStats(c.food, c.magic, c.coin));
            }
            if (c.characteristicsDirty) {
                store.setCharacterCharacteristics(x.match.id(), c.id,
                        games.paths.core.model.match.MatchTraitCodec.join(new ArrayList<>(c.characteristics)));
            }
        }
    }

    private EventExecutionResult buildResult(Exec x) {
        flush(x);
        Live actor = x.live(x.actor);
        boolean changed = x.timeEnded || x.itemAdded || x.itemRemoved || x.weatherApplied
                || x.movementApplied || x.forcedSleep || x.comaTriggered || x.gameOver
                || !x.statChanges.isEmpty() || !x.registryChanges.isEmpty()
                || !x.traitChanges.isEmpty() || !x.characteristicChanges.isEmpty();

        return new EventExecutionResult(
                x.match.uuid(), x.event.getUuid(), x.event.getType(),
                resolveCard(x, x.event.getIdCard()),
                new ArrayList<>(x.executedEventUuids),
                x.energySpent, x.coinSpent, actor.energy, actor.coin, x.currentClock,
                false, // turnConsumed — v0.29.0 never touches the turn queue
                x.timeEnded, x.itemAdded, x.itemRemoved, x.weatherApplied, x.movementApplied,
                x.forcedSleep, x.comaTriggered, x.gameOver, changed,
                x.statChanges, x.registryChanges, x.traitChanges, x.itemChanges,
                x.characteristicChanges, x.locationChanges, x.effects, List.of());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private CardInfo resolveCard(Exec x, Integer idCard) {
        if (contentQueryPort == null || idCard == null) {
            return null;
        }
        return x.cardCache.computeIfAbsent(idCard,
                id -> contentQueryPort.getCardByStoryIdAndCardId(x.match.idStory(), id, x.lang));
    }

    private static String resolveLang(String lang) {
        return (lang == null || lang.isBlank()) ? DEFAULT_LANG : lang;
    }

    private long requireUser(String userUuid) {
        return userAccessPort.findByUuid(userUuid)
                .map(UserAccessPort.UserView::id)
                .orElseThrow(EventExecutionService::notFound);
    }

    private MatchEventView requireMatch(String matchUuid) {
        return store.findMatchByUuid(matchUuid).orElseThrow(EventExecutionService::notFound);
    }

    /** Masks an unknown match AND a caller who is not in it: neither leaks the other's existence. */
    private static EventExecutionException notFound() {
        return new EventExecutionException(EventExecutionException.Code.MATCH_NOT_FOUND,
                "Match not found or not accessible");
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static List<String> csv(String s) {
        return games.paths.core.model.match.MatchTraitCodec.split(s);
    }

    /** CSV of story-local trait ids; anything non-numeric is skipped rather than throwing. */
    private static List<Long> csvIds(String s) {
        List<Long> out = new ArrayList<>();
        for (String part : csv(s)) {
            try {
                out.add(Long.valueOf(part.trim()));
            } catch (NumberFormatException notAnId) {
                // authored noise
            }
        }
        return out;
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    // ── execution state ─────────────────────────────────────────────────────

    /**
     * The mutable accumulator of one execution. Character stats are edited in memory
     * ({@link Live}) and written once at the end, so a chain of effects on the same character
     * costs one UPDATE rather than one per effect — and each effect sees what the previous
     * one did.
     */
    private final class Exec {
        final MatchEventView match;
        final EventActorView actor;
        final EventCheckContext ctx;
        final String lang;
        final EventEntity event;

        final Map<Long, Live> living = new HashMap<>();
        final Set<Long> visited = new HashSet<>();
        final Set<String> executedEventUuids = new LinkedHashSet<>();
        final Map<Integer, CardInfo> cardCache = new HashMap<>();

        final List<StatChange> statChanges = new ArrayList<>();
        final List<RegistryChange> registryChanges = new ArrayList<>();
        final List<TraitChange> traitChanges = new ArrayList<>();
        final List<ItemChange> itemChanges = new ArrayList<>();
        final List<CharacteristicChange> characteristicChanges = new ArrayList<>();
        final List<LocationChange> locationChanges = new ArrayList<>();
        final List<AppliedEffect> effects = new ArrayList<>();

        /** Current location per character: seeded from the views, rewritten by forced movement. */
        final Map<Long, Long> locationByCharacter = new HashMap<>();

        int currentClock;
        int energySpent;
        int coinSpent;
        boolean endTime;
        boolean timeEnded;
        boolean itemAdded;
        boolean itemRemoved;
        boolean weatherApplied;
        boolean movementApplied;
        boolean forcedSleep;
        boolean comaTriggered;
        boolean gameOver;
        boolean flushed;

        private List<EventActorView> allCharacters;
        private Map<Long, String> itemUuids;
        private Map<Long, String> traitUuids;
        private Map<Long, String> locationUuids;

        Exec(MatchEventView match, EventActorView actor, EventCheckContext ctx,
             String lang, EventEntity event) {
            this.match = match;
            this.actor = actor;
            this.ctx = ctx;
            this.lang = lang;
            this.event = event;
            this.currentClock = match.currentClock();
        }

        /** Lazily loaded: only a target=ALL effect needs the other characters. */
        List<EventActorView> allCharacters() {
            if (allCharacters == null) {
                allCharacters = store.findCharactersByMatchId(match.id());
            }
            return allCharacters;
        }

        Map<Long, String> itemUuids() {
            if (itemUuids == null) {
                itemUuids = store.findItemUuidsById(match.idStory());
            }
            return itemUuids;
        }

        Map<Long, String> traitUuids() {
            if (traitUuids == null) {
                traitUuids = store.findTraitUuidsById(match.idStory());
            }
            return traitUuids;
        }

        /** Lazily loaded: only a forced-movement effect needs the story's locations. */
        Map<Long, String> locationUuids() {
            if (locationUuids == null) {
                locationUuids = store.findLocationUuidsById(match.idStory());
            }
            return locationUuids;
        }

        /** The tracked position wins over the (possibly stale) view. */
        Long locationOf(EventActorView v) {
            if (!locationByCharacter.containsKey(v.id())) {
                locationByCharacter.put(v.id(), v.idLocation());
            }
            return locationByCharacter.get(v.id());
        }

        void setLocation(long idCharacter, long idLocation) {
            locationByCharacter.put(idCharacter, idLocation);
        }

        Live live(EventActorView view) {
            return living.computeIfAbsent(view.id(), id -> new Live(view,
                    store.findBackpack(match.id(), view.id())
                            .orElse(new BackpackStats(0, 0, 0))));
        }

        /**
         * After a time-end the Step 26 recovery rewrote the character rows, so the in-memory
         * copy is stale. Re-read the actor's stats to report what the database now holds.
         */
        void refreshActorAfterTimeEnd() {
            store.findCharacterByMatchAndUser(match.id(), actor.idUser()).ifPresent(fresh -> {
                Live a = live(actor);
                a.energy = fresh.energy();
                a.life = fresh.life();
                a.sad = fresh.sad();
            });
        }
    }

    /** In-memory, mutable view of one character for the duration of an execution. */
    private static final class Live {
        final long id;
        int dexterity;
        int intelligence;
        int constitution;
        int energy;
        int life;
        int sad;
        int exp;
        final int energyMax;
        final int lifeMax;
        final int sadMax;
        int food;
        int magic;
        int coin;
        final Set<String> characteristics;
        boolean backpackDirty;
        boolean characteristicsDirty;
        boolean comaSet;

        Live(EventActorView v, BackpackStats backpack) {
            this.id = v.id();
            this.dexterity = v.dexterity();
            this.intelligence = v.intelligence();
            this.constitution = v.constitution();
            this.energy = v.energy();
            this.life = v.life();
            this.sad = v.sad();
            this.exp = v.exp();
            this.energyMax = v.energyMax();
            this.lifeMax = v.lifeMax();
            this.sadMax = v.sadMax();
            this.food = backpack.food();
            this.magic = backpack.magic();
            this.coin = backpack.coin();
            this.characteristics = new LinkedHashSet<>(
                    games.paths.core.model.match.MatchTraitCodec.split(v.characteristics()));
            this.comaSet = v.isComa();
        }
    }
}
