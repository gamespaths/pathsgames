package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntityId;
import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.match.LogMovementEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.entity.story.LocationNeighborEntity;
import games.paths.core.port.match.MovementStorePort;
import games.paths.core.port.match.WeatherStorePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogMovementRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * MovementStoreAdapter - JPA adapter implementing {@link MovementStorePort} for
 * the Step 28 movement system. Reuses the story read port (locations/neighbors)
 * and the weather store port (current move costs + registry value).
 */
@Repository
@Transactional
public class MovementStoreAdapter implements MovementStorePort {

    private final GamingMatchRepository matchRepository;
    private final GamingCharacterInstanceRepository characterRepository;
    private final LogMovementRepository logMovementRepository;
    private final GamingInventoryItemsRepository inventoryRepository;
    private final GamingBackpackResourcesRepository backpackRepository;
    private final StoryReadPort storyReadPort;
    private final WeatherStorePort weatherStorePort;

    public MovementStoreAdapter(GamingMatchRepository matchRepository,
                                GamingCharacterInstanceRepository characterRepository,
                                LogMovementRepository logMovementRepository,
                                GamingInventoryItemsRepository inventoryRepository,
                                GamingBackpackResourcesRepository backpackRepository,
                                StoryReadPort storyReadPort,
                                WeatherStorePort weatherStorePort) {
        this.matchRepository = matchRepository;
        this.characterRepository = characterRepository;
        this.logMovementRepository = logMovementRepository;
        this.inventoryRepository = inventoryRepository;
        this.backpackRepository = backpackRepository;
        this.storyReadPort = storyReadPort;
        this.weatherStorePort = weatherStorePort;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MatchMovementView> findMatchByUuid(String uuid) {
        return matchRepository.findByUuid(uuid).map(m -> new MatchMovementView(
                m.getId(), m.getUuid(), m.getStatus(), nz(m.getCurrentClock()),
                m.getIdStory() == null ? 0L : m.getIdStory(), m.getIdUserCreator()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MoveCharacterView> findCharacterByMatchAndUser(long idMatch, long idUser) {
        Map<Long, Integer> carried = carriedWeightByCharacter(idMatch);
        Map<Long, int[]> backpacks = backpacksByCharacter(idMatch);
        return characterRepository.findByIdMatchAndIdUser(idMatch, idUser)
                .map(c -> toView(c, carried.getOrDefault(c.getId(), 0), backpack(backpacks, c.getId())));
    }

    @Override
    @Transactional(readOnly = true)
    public List<MoveCharacterView> findCharactersByMatchId(long idMatch) {
        // The map is built ONCE for the whole match: three queries no matter how many
        // characters it holds, instead of one inventory read per character.
        Map<Long, Integer> carried = carriedWeightByCharacter(idMatch);
        Map<Long, int[]> backpacks = backpacksByCharacter(idMatch);
        List<MoveCharacterView> out = new ArrayList<>();
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            out.add(toView(c, carried.getOrDefault(c.getId(), 0), backpack(backpacks, c.getId())));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MoveLocationView> findLocationByStoryAndUuid(long idStory, String uuid) {
        return storyReadPort.findLocationByStoryIdAndUuid(idStory, uuid)
                .map(MovementStoreAdapter::toLocationView);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MoveLocationView> findLocationByStoryAndId(long idStory, long idLocation) {
        for (LocationEntity l : storyReadPort.findLocationsByStoryId(idStory)) {
            if (l.getId() != null && l.getId() == idLocation) {
                return Optional.of(toLocationView(l));
            }
        }
        return Optional.empty();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NeighborEdge> findNeighborsOfLocation(long idStory, long idLocation) {
        List<NeighborEdge> out = new ArrayList<>();
        for (LocationNeighborEntity n : storyReadPort.findLocationNeighborsByStoryId(idStory)) {
            long from = n.getIdLocationFrom() == null ? -1 : n.getIdLocationFrom();
            long to = n.getIdLocationTo() == null ? -1 : n.getIdLocationTo();
            if (from == idLocation || to == idLocation) {
                out.add(new NeighborEdge(from, to, n.getDirection(),
                        nz(n.getEnergyCost()), n.getConditionRegistryKey(), n.getConditionRegistryValue(),
                        n.getRegistryValueOperatorCondition(), nz(n.getFlagBack()),
                        nz(n.getCostFood()), nz(n.getCostMagic()), nz(n.getCostCoin())));
            }
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public WeatherMoveCost findCurrentWeatherMoveCost(long idMatch) {
        return weatherStorePort.findCurrentWeather(idMatch)
                .map(w -> new WeatherMoveCost(nz(w.costMoveSafeLocation()), nz(w.costMoveNotSafeLocation())))
                .orElse(new WeatherMoveCost(0, 0));
    }

    @Override
    @Transactional(readOnly = true)
    public int countCharactersAtLocation(long idMatch, long idLocation) {
        int count = 0;
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            if (c.getIdLocation() != null && c.getIdLocation() == idLocation) {
                count++;
            }
        }
        return count;
    }

    @Override
    public void updateCharacterLocationAndEnergy(long idMatch, long idCharacter, long idLocation, int energy) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setIdLocation(idLocation);
                    c.setEnergy(energy);
                    characterRepository.save(c);
                });
    }

    @Override
    public void updateBackpackResources(long idMatch, long idCharacter, int food, int magic, int coin) {
        backpackRepository.findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)
                .ifPresent(b -> {
                    b.setFood(food);
                    b.setMagic(magic);
                    b.setCoin(coin);
                    backpackRepository.save(b);
                });
    }

    @Override
    public void insertMovementLog(long idMatch, long idCharacter, Long fromLocation, long toLocation,
                                  int energyCost, int foodCost, int magicCost, int coinCost) {
        LogMovementEntity e = new LogMovementEntity();
        e.setId(logMovementRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setIdLocationFrom(fromLocation);
        e.setIdLocationTo(toLocation);
        e.setEnergy(energyCost);
        e.setFood(foodCost);
        e.setMagic(magicCost);
        e.setCoin(coinCost);
        logMovementRepository.save(e);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findVisitedLocationIds(long idMatch) {
        Set<Long> ids = new LinkedHashSet<>();
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            if (c.getIdLocation() != null) {
                ids.add(c.getIdLocation());
            }
        }
        for (LogMovementEntity l : logMovementRepository.findByIdMatch(idMatch)) {
            if (l.getIdLocationFrom() != null) {
                ids.add(l.getIdLocationFrom());
            }
            if (l.getIdLocationTo() != null) {
                ids.add(l.getIdLocationTo());
            }
        }
        return new ArrayList<>(ids);
    }

    // ── mappers ───────────────────────────────────────────────────────────

    private static MoveCharacterView toView(GamingCharacterInstanceEntity c, int carriedWeight,
                                            int[] resources) {
        return new MoveCharacterView(
                c.getId(), c.getUuid(), c.getIdUser(), c.getIdLocation(),
                nz(c.getEnergy()), nz(c.getEnergyMax()),
                carriedWeight, nz(c.getWeightMax()),
                Boolean.TRUE.equals(c.getIsSleeping()), Boolean.TRUE.equals(c.getIsComa()),
                resources[0], resources[1], resources[2]);
    }

    /**
     * v0.35.3 — {food, magic, coin} per character, one query for the whole match, same
     * shape as {@link #carriedWeightByCharacter(long)}. A character with no backpack row
     * yet reads as all-zero, which is what the gate should say about somebody who owns
     * nothing.
     */
    private Map<Long, int[]> backpacksByCharacter(long idMatch) {
        Map<Long, int[]> out = new HashMap<>();
        for (GamingBackpackResourcesEntity b : backpackRepository.findByIdMatch(idMatch)) {
            out.put(b.getIdCharacterMatch(),
                    new int[]{nz(b.getFood()), nz(b.getMagic()), nz(b.getCoin())});
        }
        return out;
    }

    private static final int[] NO_RESOURCES = new int[]{0, 0, 0};

    private static int[] backpack(Map<Long, int[]> backpacks, Long idCharacter) {
        int[] r = backpacks.get(idCharacter);
        return r == null ? NO_RESOURCES : r;
    }

    /**
     * Step 35 — carried weight per character for the whole match, in a constant number
     * of queries. The formula is the one the match {@code /info} endpoint reports:
     * {@code Sigma (item.weight x amount)}, an unknown item weighing 0, a null weight 0
     * and a null amount 1. The two MUST agree, or {@code /info} would show a weight the
     * movement gate does not act on.
     */
    private Map<Long, Integer> carriedWeightByCharacter(long idMatch) {
        Long idStory = matchRepository.findById(idMatch)
                .map(m -> m.getIdStory()).orElse(null);
        if (idStory == null) {
            return Map.of();
        }
        Map<Long, Integer> unitWeight = new HashMap<>();
        for (ItemEntity i : storyReadPort.findItemsByStoryId(idStory)) {
            unitWeight.put(i.getId(), nz(i.getWeight()));
        }
        Map<Long, Integer> out = new HashMap<>();
        for (GamingInventoryItemsEntity r : inventoryRepository.findByIdMatch(idMatch)) {
            int w = r.getIdItem() == null ? 0 : unitWeight.getOrDefault(r.getIdItem(), 0);
            int a = r.getAmount() == null ? 1 : r.getAmount();
            out.merge(r.getIdCharacterMatch(), w * a, Integer::sum);
        }
        return out;
    }

    private static MoveLocationView toLocationView(LocationEntity l) {
        return new MoveLocationView(
                l.getId(), l.getUuid(), l.getIdCard(),
                nz(l.getSecureParam()), nz(l.getCostEnergyEnter()), nz(l.getMaxCharacters()));
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
