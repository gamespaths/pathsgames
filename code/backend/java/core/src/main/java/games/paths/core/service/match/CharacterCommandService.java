package games.paths.core.service.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.ClassBonusEntity;
import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.JoinMatchCommand;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.MatchTraitCodec;
import games.paths.core.port.match.CharacterCommandPort;
import games.paths.core.port.match.CharacterPersistencePort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * CharacterCommandService - Domain service implementing the character-join flow
 * (Step 21). The final statistics are computed from the character template, the
 * selected class (base attributes + class-bonus rows), the difficulty stat
 * deltas and the selected traits; life and energy start at their computed
 * maximum and the character is placed at the story start location.
 *
 * <p>See {@code documentation_v0/Step21_CharacterSelection.md}.</p>
 */
public class CharacterCommandService implements CharacterCommandPort {

    private final StoryReadPort storyReadPort;
    private final MatchReadPort matchReadPort;
    private final UserAccessPort userAccessPort;
    private final CharacterPersistencePort persistencePort;

    public CharacterCommandService(StoryReadPort storyReadPort,
                                   MatchReadPort matchReadPort,
                                   UserAccessPort userAccessPort,
                                   CharacterPersistencePort persistencePort) {
        this.storyReadPort = storyReadPort;
        this.matchReadPort = matchReadPort;
        this.userAccessPort = userAccessPort;
        this.persistencePort = persistencePort;
    }

    @Override
    public CharacterInstanceInfo join(JoinMatchCommand command) {
        if (command == null || isBlank(command.getMatchUuid()) || isBlank(command.getUserUuid())) {
            throw new CharacterJoinException(CharacterJoinException.Code.INVALID_INPUT,
                    "matchUuid and userUuid are required");
        }

        GamingMatchEntity match = matchReadPort.findMatchByUuid(command.getMatchUuid())
                .orElseThrow(() -> new CharacterJoinException(
                        CharacterJoinException.Code.MATCH_NOT_FOUND,
                        "Match not found: " + command.getMatchUuid()));

        if (MatchStatuses.isTerminal(match.getStatus())) {
            throw new CharacterJoinException(CharacterJoinException.Code.MATCH_NOT_JOINABLE,
                    "Match is in a terminal status and cannot be joined");
        }

        UserAccessPort.UserView user = userAccessPort.findByUuid(command.getUserUuid())
                .orElseThrow(() -> new CharacterJoinException(
                        CharacterJoinException.Code.USER_NOT_FOUND, "User does not exist"));
        if (user.isBanned() || user.isBlocked()) {
            throw new CharacterJoinException(CharacterJoinException.Code.USER_BANNED,
                    "User is not allowed to join matches");
        }

        if (persistencePort.findCharacterByMatchIdAndUserId(match.getId(), user.id()).isPresent()) {
            throw new CharacterJoinException(CharacterJoinException.Code.ALREADY_JOINED,
                    "User already has a character in this match");
        }

        StoryEntity story = storyReadPort.findStoryById(match.getIdStory())
                .orElseThrow(() -> new CharacterJoinException(
                        CharacterJoinException.Code.MATCH_NOT_FOUND, "Match story not found"));

        // Resolve the loadout: prefer the request, fall back to the loadout
        // stored on the match at creation (single-player path).
        String templateUuid = firstNonBlank(command.getCharacterTemplateUuid(), match.getCharacterTemplateUuid());
        String classUuid = firstNonBlank(command.getClassUuid(), match.getClassUuid());
        List<String> traitUuids = !command.getTraitUuids().isEmpty()
                ? command.getTraitUuids()
                : MatchTraitCodec.split(match.getTraitUuids());

        if (isBlank(templateUuid)) {
            throw new CharacterJoinException(CharacterJoinException.Code.INVALID_INPUT,
                    "characterTemplateUuid is required (none provided and none stored on the match)");
        }

        CharacterTemplateEntity template =
                storyReadPort.findCharacterTemplateByStoryIdAndUuid(story.getId(), templateUuid)
                        .orElseThrow(() -> new CharacterJoinException(
                                CharacterJoinException.Code.TEMPLATE_NOT_FOUND,
                                "Character template not found: " + templateUuid));

        ClassEntity clazz = null;
        if (!isBlank(classUuid)) {
            clazz = storyReadPort.findClassByStoryIdAndUuid(story.getId(), classUuid)
                    .orElseThrow(() -> new CharacterJoinException(
                            CharacterJoinException.Code.CLASS_NOT_FOUND,
                            "Class not found: " + classUuid));
            validateClassCompatibility(template, clazz);
        }

        StoryDifficultyEntity difficulty = resolveDifficulty(story.getId(), match.getIdDifficulty());
        List<TraitEntity> traits = resolveAndValidateTraits(story.getId(), clazz, difficulty, traitUuids);
        List<ClassBonusEntity> classBonuses = resolveClassBonuses(story.getId(), clazz);

        long nextId = persistencePort.countCharactersByMatchId(match.getId()) + 1L;
        GamingCharacterInstanceEntity instance =
                buildInstance(match, user, story, template, clazz, difficulty, traits, classBonuses, nextId);
        GamingCharacterInstanceEntity saved = persistencePort.saveCharacter(instance);

        GamingBackpackResourcesEntity backpack = new GamingBackpackResourcesEntity();
        backpack.setId(saved.getId());
        backpack.setIdMatch(match.getId());
        backpack.setIdCharacterMatch(saved.getId());
        backpack.setFood(0);
        backpack.setMagic(0);
        backpack.setCoin(0);
        persistencePort.saveBackpack(backpack);

        List<GamingCharacterTraitsEntity> traitRows = new ArrayList<>();
        long traitId = 1L;
        for (TraitEntity t : traits) {
            GamingCharacterTraitsEntity row = new GamingCharacterTraitsEntity();
            row.setId(traitId++);
            row.setIdMatch(match.getId());
            row.setIdCharacterMatch(saved.getId());
            row.setIdTraits(t.getId());
            traitRows.add(row);
        }
        persistencePort.saveTraits(traitRows);

        return toInfo(saved, match, story, user.uuid(), templateUuid, classUuid, traitUuids, backpack);
    }

    private void validateClassCompatibility(CharacterTemplateEntity template, ClassEntity clazz) {
        Long classId = clazz.getId();
        Long permitted = template.getIdClassPermitted() != null
                ? template.getIdClassPermitted().longValue() : null;
        Long prohibited = template.getIdClassProhibited() != null
                ? template.getIdClassProhibited().longValue() : null;
        if (permitted != null && !permitted.equals(classId)) {
            throw new CharacterJoinException(CharacterJoinException.Code.CLASS_NOT_COMPATIBLE,
                    "Selected class is not permitted for this character template");
        }
        if (prohibited != null && prohibited.equals(classId)) {
            throw new CharacterJoinException(CharacterJoinException.Code.CLASS_NOT_COMPATIBLE,
                    "Selected class is prohibited for this character template");
        }
    }

    /**
     * Step 23 — strict trait resolution: unknown uuids, duplicates, class
     * incompatibilities and difficulty cost-budget overruns are rejected.
     */
    private List<TraitEntity> resolveAndValidateTraits(Long storyId, ClassEntity clazz,
                                                       StoryDifficultyEntity difficulty,
                                                       List<String> traitUuids) {
        try {
            return TraitSelectionValidator.resolveAndValidate(
                    storyReadPort, storyId, clazz, difficulty, traitUuids);
        } catch (TraitSelectionValidator.TraitSelectionException ex) {
            throw new CharacterJoinException(
                    CharacterJoinException.Code.valueOf(ex.getViolation().name()), ex.getMessage());
        }
    }

    private StoryDifficultyEntity resolveDifficulty(Long storyId, Long difficultyId) {
        if (difficultyId == null) {
            return null;
        }
        return storyReadPort.findDifficultiesByStoryId(storyId).stream()
                .filter(d -> difficultyId.equals(d.getId()))
                .findFirst()
                .orElse(null);
    }

    private List<ClassBonusEntity> resolveClassBonuses(Long storyId, ClassEntity clazz) {
        if (clazz == null) {
            return List.of();
        }
        List<ClassBonusEntity> result = new ArrayList<>();
        for (ClassBonusEntity b : storyReadPort.findClassBonusesByStoryId(storyId)) {
            if (b.getIdClass() != null && b.getIdClass().longValue() == clazz.getId()) {
                result.add(b);
            }
        }
        return result;
    }

    private GamingCharacterInstanceEntity buildInstance(GamingMatchEntity match,
                                                        UserAccessPort.UserView user,
                                                        StoryEntity story,
                                                        CharacterTemplateEntity template,
                                                        ClassEntity clazz,
                                                        StoryDifficultyEntity difficulty,
                                                        List<TraitEntity> traits,
                                                        List<ClassBonusEntity> classBonuses,
                                                        long nextId) {
        int dexterity = template.getDexterityStart()
                + base(clazz != null ? clazz.getDexterityBase() : null)
                + stat(difficulty != null ? difficulty.getDexterity() : null)
                + sumTrait(traits, "dex")
                + sumBonus(classBonuses, "dex");
        int intelligence = template.getIntelligenceStart()
                + base(clazz != null ? clazz.getIntelligenceBase() : null)
                + stat(difficulty != null ? difficulty.getIntelligence() : null)
                + sumTrait(traits, "int")
                + sumBonus(classBonuses, "int");
        int constitution = template.getConstitutionStart()
                + base(clazz != null ? clazz.getConstitutionBase() : null)
                + stat(difficulty != null ? difficulty.getConstitution() : null)
                + sumTrait(traits, "con")
                + sumBonus(classBonuses, "con");
        int lifeMax = template.getLifeMax()
                + stat(difficulty != null ? difficulty.getLife() : null)
                + sumTrait(traits, "life")
                + sumBonus(classBonuses, "life");
        int energyMax = template.getEnergyMax()
                + stat(difficulty != null ? difficulty.getEnergy() : null)
                + sumTrait(traits, "energy")
                + sumBonus(classBonuses, "energy");
        int sadMax = template.getSadMax()
                + stat(difficulty != null ? difficulty.getSad() : null)
                + sumTrait(traits, "sad")
                + sumBonus(classBonuses, "sad");
        // weightMax has no character-template contribution: the carry-capacity
        // base lives on the class, with difficulty/trait/bonus deltas on top.
        int weightMax = base(clazz != null ? clazz.getWeightMax() : null)
                + stat(difficulty != null ? difficulty.getWeight() : null)
                + sumTrait(traits, "weight")
                + sumBonus(classBonuses, "weight");

        GamingCharacterInstanceEntity instance = new GamingCharacterInstanceEntity();
        instance.setId(nextId);
        instance.setIdMatch(match.getId());
        instance.setIdUser(user.id());
        instance.setIdCharacterTemplate(template.getIdTipo());
        instance.setDexterity(dexterity);
        instance.setIntelligence(intelligence);
        instance.setConstitution(constitution);
        instance.setLife(lifeMax);     // start full
        instance.setEnergy(energyMax); // start full
        instance.setSad(0);
        instance.setLifeMax(lifeMax);
        instance.setEnergyMax(energyMax);
        instance.setSadMax(sadMax);
        instance.setWeightMax(weightMax);
        instance.setIdLocation(story.getIdLocationStart() != null
                ? story.getIdLocationStart().longValue() : null);
        instance.setIsSleeping(false);
        instance.setIsComa(false);
        return instance;
    }

    private CharacterInstanceInfo toInfo(GamingCharacterInstanceEntity saved, GamingMatchEntity match,
                                         StoryEntity story, String userUuid, String templateUuid,
                                         String classUuid, List<String> traitUuids,
                                         GamingBackpackResourcesEntity backpack) {
        CharacterInstanceInfo info = new CharacterInstanceInfo();
        info.setUuid(saved.getUuid());
        info.setMatchUuid(match.getUuid());
        info.setUserUuid(userUuid);
        info.setCharacterTemplateUuid(templateUuid);
        info.setClassUuid(classUuid);
        info.setDexterity(saved.getDexterity());
        info.setIntelligence(saved.getIntelligence());
        info.setConstitution(saved.getConstitution());
        info.setEnergy(saved.getEnergy());
        info.setLife(saved.getLife());
        info.setSad(saved.getSad());
        info.setLifeMax(saved.getLifeMax());
        info.setEnergyMax(saved.getEnergyMax());
        info.setSadMax(saved.getSadMax());
        info.setWeightMax(saved.getWeightMax());
        info.setWeight(0); // fresh character starts with no items
        info.setItems(new ArrayList<>());
        info.setIdLocation(saved.getIdLocation());
        info.setIsSleeping(saved.getIsSleeping());
        info.setIsComa(saved.getIsComa());
        info.setTraitUuids(new ArrayList<>(traitUuids));
        info.setFood(backpack.getFood());
        info.setMagic(backpack.getMagic());
        info.setCoin(backpack.getCoin());
        if (saved.getIdLocation() != null && story != null) {
            for (LocationEntity l : storyReadPort.findLocationsByStoryId(story.getId())) {
                if (saved.getIdLocation().equals(l.getId())) {
                    info.setLocationUuid(l.getUuid());
                    info.setLocationName("location-" + l.getId());
                    break;
                }
            }
        }
        return info;
    }

    private static int base(Integer v) { return v != null ? v : 0; }

    private static int stat(Integer v) { return v != null ? v : 0; }

    private static int sumTrait(List<TraitEntity> traits, String stat) {
        int total = 0;
        for (TraitEntity t : traits) {
            total += statOfTrait(t, stat);
        }
        return total;
    }

    private static int statOfTrait(TraitEntity t, String stat) {
        return switch (stat) {
            case "dex" -> nz(t.getDexterity());
            case "int" -> nz(t.getIntelligence());
            case "con" -> nz(t.getConstitution());
            case "life" -> nz(t.getLife());
            case "energy" -> nz(t.getEnergy());
            case "sad" -> nz(t.getSad());
            case "weight" -> nz(t.getWeight());
            default -> 0;
        };
    }

    private static int sumBonus(List<ClassBonusEntity> bonuses, String stat) {
        int total = 0;
        for (ClassBonusEntity b : bonuses) {
            if (stat.equalsIgnoreCase(b.getStatistic())) {
                total += nz(b.getValue());
            }
        }
        return total;
    }

    private static int nz(Integer v) { return v != null ? v : 0; }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        return b;
    }
}
