package games.paths.core.entity.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for all story-domain JPA entities.
 *
 * <p>Each entity has a {@code @Nested} class that tests:</p>
 * <ol>
 *   <li>Entity-specific {@code @PrePersist} default values (where applicable)</li>
 *   <li>Getters and setters for all entity-specific fields</li>
 * </ol>
 *
 * <p>Shared base-class behaviour (uuid generation, timestamps, {@code onUpdate})
 * is covered by {@link BaseStoryEntityTest}.</p>
 */
class StoryEntitiesTest {

    // ── CardEntity ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("CardEntity")
    class CardEntityTests {

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            CardEntity e = new CardEntity();
            e.setId(1L);
            e.setIdStory(2L);
            e.setUrlImmage("http://img.com/img.png");
            e.setIdTextTitle(10);
            e.setIdTextDescription(11);
            e.setIdTextCopyright(12);
            e.setLinkCopyright("https://copy.com");
            e.setIdCreator(5);
            e.setAlternativeImage("alt.jpg");
            e.setAwesomeIcon("fa-star");
            e.setStyleMain("main");
            e.setStyleDetail("detail");

            assertAll(
                () -> assertEquals(1L,  e.getId()),
                () -> assertEquals(2L,  e.getIdStory()),
                () -> assertEquals("http://img.com/img.png", e.getUrlImmage()),
                () -> assertEquals(10,  e.getIdTextTitle()),
                () -> assertEquals(11,  e.getIdTextDescription()),
                () -> assertEquals(12,  e.getIdTextCopyright()),
                () -> assertEquals("https://copy.com", e.getLinkCopyright()),
                () -> assertEquals(5,   e.getIdCreator()),
                () -> assertEquals("alt.jpg",  e.getAlternativeImage()),
                () -> assertEquals("fa-star",  e.getAwesomeIcon()),
                () -> assertEquals("main",     e.getStyleMain()),
                () -> assertEquals("detail",   e.getStyleDetail())
            );
        }
    }

    // ── CharacterTemplateEntity ──────────────────────────────────────────────────

    @Nested
    @DisplayName("CharacterTemplateEntity")
    class CharacterTemplateEntityTests {

        @Test
        @DisplayName("@PrePersist sets numeric defaults")
        void prePersist_defaults() {
            CharacterTemplateEntity e = new CharacterTemplateEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(10, e.getLifeMax()),
                () -> assertEquals(10, e.getEnergyMax()),
                () -> assertEquals(10, e.getSadMax()),
                () -> assertEquals(1,  e.getDexterityStart()),
                () -> assertEquals(1,  e.getIntelligenceStart()),
                () -> assertEquals(1,  e.getConstitutionStart())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwriteExplicitValues() {
            CharacterTemplateEntity e = new CharacterTemplateEntity();
            e.setLifeMax(20);
            e.setEnergyMax(30);
            e.setSadMax(15);
            e.setDexterityStart(5);
            e.setIntelligenceStart(4);
            e.setConstitutionStart(3);
            e.onCreate();
            assertAll(
                () -> assertEquals(20, e.getLifeMax()),
                () -> assertEquals(30, e.getEnergyMax()),
                () -> assertEquals(15, e.getSadMax()),
                () -> assertEquals(5, e.getDexterityStart()),
                () -> assertEquals(4, e.getIntelligenceStart()),
                () -> assertEquals(3, e.getConstitutionStart())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            CharacterTemplateEntity e = new CharacterTemplateEntity();
            e.setIdTipo(9L);
            e.setIdCard(1);
            e.setIdStory(2L);
            e.setIdTextName(3);
            e.setIdTextDescription(4);
            e.setLifeMax(15);
            e.setEnergyMax(12);
            e.setSadMax(8);
            e.setDexterityStart(2);
            e.setIntelligenceStart(3);
            e.setConstitutionStart(4);

            assertAll(
                () -> assertEquals(9L, e.getIdTipo()),
                () -> assertEquals(1,  e.getIdCard()),
                () -> assertEquals(2L, e.getIdStory()),
                () -> assertEquals(3,  e.getIdTextName()),
                () -> assertEquals(4,  e.getIdTextDescription()),
                () -> assertEquals(15, e.getLifeMax()),
                () -> assertEquals(12, e.getEnergyMax()),
                () -> assertEquals(8,  e.getSadMax()),
                () -> assertEquals(2,  e.getDexterityStart()),
                () -> assertEquals(3,  e.getIntelligenceStart()),
                () -> assertEquals(4,  e.getConstitutionStart())
            );
        }
    }

    // ── ChoiceConditionEntity ────────────────────────────────────────────────────

    @Nested
    @DisplayName("ChoiceConditionEntity")
    class ChoiceConditionEntityTests {

        @Test
        @DisplayName("@PrePersist sets default operator '='")
        void prePersist_defaults() {
            ChoiceConditionEntity e = new ChoiceConditionEntity();
            e.onCreate();
            assertEquals("=", e.getOperator());
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set operator")
        void prePersist_doesNotOverwrite() {
            ChoiceConditionEntity e = new ChoiceConditionEntity();
            e.setOperator("!=");
            e.onCreate();
            assertEquals("!=", e.getOperator());
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            ChoiceConditionEntity e = new ChoiceConditionEntity();
            e.setId(1L);
            e.setIdStory(2L);
            e.setIdChoices(3);
            e.setType("REGISTRY");
            e.setKey("k");
            e.setValue("v");
            e.setOperator("!=");
            e.setIdTextName(10);
            e.setIdTextDescription(11);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(2L, e.getIdStory()),
                () -> assertEquals(3, e.getIdChoices()),
                () -> assertEquals("REGISTRY", e.getType()),
                () -> assertEquals("k", e.getKey()),
                () -> assertEquals("v", e.getValue()),
                () -> assertEquals("!=", e.getOperator()),
                () -> assertEquals(10, e.getIdTextName()),
                () -> assertEquals(11, e.getIdTextDescription())
            );
        }
    }

    // ── ChoiceEffectEntity ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("ChoiceEffectEntity")
    class ChoiceEffectEntityTests {

        @Test
        @DisplayName("@PrePersist sets default flagGroup=0 and value=0")
        void prePersist_defaults() {
            ChoiceEffectEntity e = new ChoiceEffectEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(0, e.getFlagGroup()),
                () -> assertEquals(0, e.getValue())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            ChoiceEffectEntity e = new ChoiceEffectEntity();
            e.setFlagGroup(1);
            e.setValue(5);
            e.onCreate();
            assertAll(
                () -> assertEquals(1, e.getFlagGroup()),
                () -> assertEquals(5, e.getValue())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            ChoiceEffectEntity e = new ChoiceEffectEntity();
            e.setId(1L);
            e.setIdStory(2L);
            e.setIdChoices(3);
            e.setIdScelta(4);
            e.setFlagGroup(1);
            e.setStatistics("LIFE");
            e.setValue(5);
            e.setIdText(6);
            e.setKey("health");
            e.setValueToAdd("10");
            e.setValueToRemove("5");

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(2L, e.getIdStory()),
                () -> assertEquals(3, e.getIdChoices()),
                () -> assertEquals(4, e.getIdScelta()),
                () -> assertEquals(1, e.getFlagGroup()),
                () -> assertEquals("LIFE", e.getStatistics()),
                () -> assertEquals(5, e.getValue()),
                () -> assertEquals(6, e.getIdText()),
                () -> assertEquals("health", e.getKey()),
                () -> assertEquals("10", e.getValueToAdd()),
                () -> assertEquals("5", e.getValueToRemove())
            );
        }
    }

    // ── ChoiceEntity ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("ChoiceEntity")
    class ChoiceEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: priority=0, otherwiseFlag=0, isProgress=0, logicOperator=AND")
        void prePersist_defaults() {
            ChoiceEntity e = new ChoiceEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(0, e.getPriority()),
                () -> assertEquals(0, e.getOtherwiseFlag()),
                () -> assertEquals(0, e.getIsProgress()),
                () -> assertEquals("AND", e.getLogicOperator())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            ChoiceEntity e = new ChoiceEntity();
            e.setPriority(3);
            e.setOtherwiseFlag(1);
            e.setIsProgress(1);
            e.setLogicOperator("OR");
            e.onCreate();
            assertAll(
                () -> assertEquals(3, e.getPriority()),
                () -> assertEquals(1, e.getOtherwiseFlag()),
                () -> assertEquals(1, e.getIsProgress()),
                () -> assertEquals("OR", e.getLogicOperator())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            ChoiceEntity e = new ChoiceEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdEvent(4);
            e.setIdLocation(5);
            e.setPriority(1);
            e.setIdTextName(6);
            e.setIdTextDescription(7);
            e.setIdTextNarrative(8);
            e.setIdEventTorun(9);
            e.setLimitSad(10);
            e.setLimitDex(11);
            e.setLimitInt(12);
            e.setLimitCos(13);
            e.setOtherwiseFlag(1);
            e.setIsProgress(1);
            e.setLogicOperator("OR");

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(2, e.getIdCard()),
                () -> assertEquals(3L, e.getIdStory()),
                () -> assertEquals("OR", e.getLogicOperator()),
                () -> assertEquals(1, e.getIsProgress()),
                () -> assertEquals(1, e.getOtherwiseFlag()),
                () -> assertEquals(10, e.getLimitSad()),
                () -> assertEquals(11, e.getLimitDex()),
                () -> assertEquals(12, e.getLimitInt()),
                () -> assertEquals(13, e.getLimitCos())
            );
        }
    }

    // ── ClassBonusEntity ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("ClassBonusEntity")
    class ClassBonusEntityTests {

        @Test
        @DisplayName("@PrePersist sets default value=0")
        void prePersist_defaults() {
            ClassBonusEntity e = new ClassBonusEntity();
            e.onCreate();
            assertEquals(0, e.getValue());
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set value")
        void prePersist_doesNotOverwrite() {
            ClassBonusEntity e = new ClassBonusEntity();
            e.setValue(7);
            e.onCreate();
            assertEquals(7, e.getValue());
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            ClassBonusEntity e = new ClassBonusEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdClass(4);
            e.setStatistic("STRENGTH");
            e.setValue(5);
            e.setIdTextName(6);
            e.setIdTextDescription(7);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(4, e.getIdClass()),
                () -> assertEquals("STRENGTH", e.getStatistic()),
                () -> assertEquals(5, e.getValue())
            );
        }
    }

    // ── ClassEntity ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("ClassEntity")
    class ClassEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: weightMax=10, bases=1")
        void prePersist_defaults() {
            ClassEntity e = new ClassEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(10, e.getWeightMax()),
                () -> assertEquals(1, e.getDexterityBase()),
                () -> assertEquals(1, e.getIntelligenceBase()),
                () -> assertEquals(1, e.getConstitutionBase())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            ClassEntity e = new ClassEntity();
            e.setWeightMax(20);
            e.setDexterityBase(3);
            e.setIntelligenceBase(4);
            e.setConstitutionBase(5);
            e.onCreate();
            assertAll(
                () -> assertEquals(20, e.getWeightMax()),
                () -> assertEquals(3, e.getDexterityBase()),
                () -> assertEquals(4, e.getIntelligenceBase()),
                () -> assertEquals(5, e.getConstitutionBase())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            ClassEntity e = new ClassEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdTextName(4);
            e.setIdTextDescription(5);
            e.setWeightMax(20);
            e.setDexterityBase(3);
            e.setIntelligenceBase(4);
            e.setConstitutionBase(5);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(20, e.getWeightMax()),
                () -> assertEquals(3, e.getDexterityBase()),
                () -> assertEquals(4, e.getIntelligenceBase()),
                () -> assertEquals(5, e.getConstitutionBase())
            );
        }
    }

    // ── CreatorEntity ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("CreatorEntity")
    class CreatorEntityTests {

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            CreatorEntity e = new CreatorEntity();
            e.setId(1L);
            e.setIdStory(2L);
            e.setIdText(3);
            e.setLink("https://link.com");
            e.setUrl("https://url.com");
            e.setUrlImage("https://img.com");
            e.setUrlEmote("https://emote.com");
            e.setUrlInstagram("https://instagram.com");

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(2L, e.getIdStory()),
                () -> assertEquals(3, e.getIdText()),
                () -> assertEquals("https://link.com", e.getLink()),
                () -> assertEquals("https://url.com", e.getUrl()),
                () -> assertEquals("https://img.com", e.getUrlImage()),
                () -> assertEquals("https://emote.com", e.getUrlEmote()),
                () -> assertEquals("https://instagram.com", e.getUrlInstagram())
            );
        }
    }

    // ── EventEffectEntity ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("EventEffectEntity")
    class EventEffectEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: target='ALL', value=0")
        void prePersist_defaults() {
            EventEffectEntity e = new EventEffectEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals("ALL", e.getTarget()),
                () -> assertEquals(0, e.getValue())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            EventEffectEntity e = new EventEffectEntity();
            e.setTarget("PLAYER");
            e.setValue(10);
            e.onCreate();
            assertAll(
                () -> assertEquals("PLAYER", e.getTarget()),
                () -> assertEquals(10, e.getValue())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            EventEffectEntity e = new EventEffectEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdEvent(4);
            e.setStatistics("LIFE");
            e.setValue(5);
            e.setTarget("PLAYER");
            e.setTraitsToAdd("BRAVE");
            e.setTraitsToRemove("WEAK");
            e.setTargetClass(6);
            e.setIdItemTarget(7);
            e.setItemAction("USE");

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals("LIFE", e.getStatistics()),
                () -> assertEquals(5, e.getValue()),
                () -> assertEquals("PLAYER", e.getTarget()),
                () -> assertEquals("BRAVE", e.getTraitsToAdd()),
                () -> assertEquals("WEAK", e.getTraitsToRemove()),
                () -> assertEquals(6, e.getTargetClass()),
                () -> assertEquals(7, e.getIdItemTarget()),
                () -> assertEquals("USE", e.getItemAction())
            );
        }
    }

    // ── EventEntity ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("EventEntity")
    class EventEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: type=NORMAL, costEnery=0, flagEndTime=0, coinCost=0")
        void prePersist_defaults() {
            EventEntity e = new EventEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals("NORMAL", e.getType()),
                () -> assertEquals(0, e.getCostEnery()),
                () -> assertEquals(0, e.getFlagEndTime()),
                () -> assertEquals(0, e.getCoinCost())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            EventEntity e = new EventEntity();
            e.setType("BATTLE");
            e.setCostEnery(5);
            e.setFlagEndTime(1);
            e.setCoinCost(10);
            e.onCreate();
            assertAll(
                () -> assertEquals("BATTLE", e.getType()),
                () -> assertEquals(5, e.getCostEnery()),
                () -> assertEquals(1, e.getFlagEndTime()),
                () -> assertEquals(10, e.getCoinCost())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            EventEntity e = new EventEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdTextName(4);
            e.setIdTextDescription(5);
            e.setType("BATTLE");
            e.setCostEnery(5);
            e.setFlagEndTime(1);
            e.setCoinCost(10);
            e.setCharacteristicToAdd("BRAVE");
            e.setCharacteristicToRemove("WEAK");
            e.setKeyToAdd("QUEST");
            e.setKeyValueToAdd("1");
            e.setIdItemToAdd(6);
            e.setIdWeather(7);
            e.setIdEventNext(8);
            e.setIdSpecificLocation(9);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals("BATTLE", e.getType()),
                () -> assertEquals(5, e.getCostEnery()),
                () -> assertEquals(1, e.getFlagEndTime()),
                () -> assertEquals(10, e.getCoinCost()),
                () -> assertEquals("BRAVE", e.getCharacteristicToAdd()),
                () -> assertEquals("WEAK", e.getCharacteristicToRemove()),
                () -> assertEquals("QUEST", e.getKeyToAdd()),
                () -> assertEquals("1", e.getKeyValueToAdd()),
                () -> assertEquals(6, e.getIdItemToAdd()),
                () -> assertEquals(7, e.getIdWeather()),
                () -> assertEquals(8, e.getIdEventNext()),
                () -> assertEquals(9, e.getIdSpecificLocation())
            );
        }
    }

    // ── GlobalRandomEventEntity ──────────────────────────────────────────────────

    @Nested
    @DisplayName("GlobalRandomEventEntity")
    class GlobalRandomEventEntityTests {

        @Test
        @DisplayName("@PrePersist sets default probability=0")
        void prePersist_defaults() {
            GlobalRandomEventEntity e = new GlobalRandomEventEntity();
            e.onCreate();
            assertEquals(0, e.getProbability());
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set probability")
        void prePersist_doesNotOverwrite() {
            GlobalRandomEventEntity e = new GlobalRandomEventEntity();
            e.setProbability(50);
            e.onCreate();
            assertEquals(50, e.getProbability());
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            GlobalRandomEventEntity e = new GlobalRandomEventEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdEvent(4);
            e.setProbability(50);
            e.setConditionKey("WEATHER");
            e.setConditionValue("RAIN");
            e.setIdText(5);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(4, e.getIdEvent()),
                () -> assertEquals(50, e.getProbability()),
                () -> assertEquals("WEATHER", e.getConditionKey()),
                () -> assertEquals("RAIN", e.getConditionValue()),
                () -> assertEquals(5, e.getIdText())
            );
        }
    }

    // ── ItemEffectEntity ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("ItemEffectEntity")
    class ItemEffectEntityTests {

        @Test
        @DisplayName("@PrePersist sets default effectValue=0")
        void prePersist_defaults() {
            ItemEffectEntity e = new ItemEffectEntity();
            e.onCreate();
            assertEquals(0, e.getEffectValue());
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set effectValue")
        void prePersist_doesNotOverwrite() {
            ItemEffectEntity e = new ItemEffectEntity();
            e.setEffectValue(25);
            e.onCreate();
            assertEquals(25, e.getEffectValue());
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            ItemEffectEntity e = new ItemEffectEntity();
            e.setId(1L);
            e.setIdStory(2L);
            e.setIdItem(3);
            e.setIdTextName(4);
            e.setIdTextDescription(5);
            e.setEffectCode("HEAL");
            e.setEffectValue(10);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(3, e.getIdItem()),
                () -> assertEquals("HEAL", e.getEffectCode()),
                () -> assertEquals(10, e.getEffectValue()),
                () -> assertEquals(4, e.getIdTextName()),
                () -> assertEquals(5, e.getIdTextDescription())
            );
        }
    }

    // ── ItemEntity ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("ItemEntity")
    class ItemEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: weight=1, isConsumabile=1")
        void prePersist_defaults() {
            ItemEntity e = new ItemEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(1, e.getWeight()),
                () -> assertEquals(1, e.getIsConsumabile())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            ItemEntity e = new ItemEntity();
            e.setWeight(5);
            e.setIsConsumabile(0);
            e.onCreate();
            assertAll(
                () -> assertEquals(5, e.getWeight()),
                () -> assertEquals(0, e.getIsConsumabile())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            ItemEntity e = new ItemEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdTextName(4);
            e.setIdTextDescription(5);
            e.setWeight(3);
            e.setIsConsumabile(1);
            e.setIdClassPermitted(6);
            e.setIdClassProhibited(7);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(3, e.getWeight()),
                () -> assertEquals(1, e.getIsConsumabile()),
                () -> assertEquals(6, e.getIdClassPermitted()),
                () -> assertEquals(7, e.getIdClassProhibited())
            );
        }
    }

    // ── KeyEntity ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("KeyEntity")
    class KeyEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: priority=0, visibility=PUBLIC")
        void prePersist_defaults() {
            KeyEntity e = new KeyEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(0, e.getPriority()),
                () -> assertEquals("PUBLIC", e.getVisibility())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            KeyEntity e = new KeyEntity();
            e.setPriority(2);
            e.setVisibility("PRIVATE");
            e.onCreate();
            assertAll(
                () -> assertEquals(2, e.getPriority()),
                () -> assertEquals("PRIVATE", e.getVisibility())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            KeyEntity e = new KeyEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setName("gold");
            e.setValue("100");
            e.setIdTextDescription(4);
            e.setGroup("resource");
            e.setPriority(2);
            e.setVisibility("PRIVATE");

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals("gold", e.getName()),
                () -> assertEquals("100", e.getValue()),
                () -> assertEquals("resource", e.getGroup()),
                () -> assertEquals(2, e.getPriority()),
                () -> assertEquals("PRIVATE", e.getVisibility())
            );
        }
    }

    // ── LocationEntity ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("LocationEntity")
    class LocationEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: isSafe=0, costEnergyEnter=1, secureParam=0, priorityAutomaticEvent=0, maxCharacters=100")
        void prePersist_defaults() {
            LocationEntity e = new LocationEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(0, e.getIsSafe()),
                () -> assertEquals(1, e.getCostEnergyEnter()),
                () -> assertEquals(0, e.getSecureParam()),
                () -> assertEquals(0, e.getPriorityAutomaticEvent()),
                () -> assertEquals(100, e.getMaxCharacters())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            LocationEntity e = new LocationEntity();
            e.setIsSafe(1);
            e.setCostEnergyEnter(5);
            e.setSecureParam(1);
            e.setPriorityAutomaticEvent(3);
            e.setMaxCharacters(50);
            e.onCreate();
            assertAll(
                () -> assertEquals(1, e.getIsSafe()),
                () -> assertEquals(5, e.getCostEnergyEnter()),
                () -> assertEquals(1, e.getSecureParam()),
                () -> assertEquals(3, e.getPriorityAutomaticEvent()),
                () -> assertEquals(50, e.getMaxCharacters())
            );
        }

        @Test
        @DisplayName("Getters for event-related fields round-trip correctly")
        void eventFieldGetters() {
            LocationEntity e = new LocationEntity();
            e.setIdEventIfCharacterStartTime(10);
            e.setIdEventIfCharacterEnterFirstTime(11);
            e.setIdEventIfFirstTime(12);
            e.setIdEventNotFirstTime(13);

            assertAll(
                () -> assertEquals(10, e.getIdEventIfCharacterStartTime()),
                () -> assertEquals(11, e.getIdEventIfCharacterEnterFirstTime()),
                () -> assertEquals(12, e.getIdEventIfFirstTime()),
                () -> assertEquals(13, e.getIdEventNotFirstTime())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            LocationEntity e = new LocationEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdTextName(4);
            e.setIdTextDescription(5);
            e.setIdTextNarrative(6);
            e.setIdImage(7);
            e.setIsSafe(1);
            e.setCostEnergyEnter(2);
            e.setCounterTime(3);
            e.setIdEventIfCounterZero(8);
            e.setSecureParam(1);
            e.setPriorityAutomaticEvent(5);
            e.setMaxCharacters(10);
            e.setIdAudio(9);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(1, e.getIsSafe()),
                () -> assertEquals(2, e.getCostEnergyEnter()),
                () -> assertEquals(3, e.getCounterTime()),
                () -> assertEquals(1, e.getSecureParam()),
                () -> assertEquals(5, e.getPriorityAutomaticEvent()),
                () -> assertEquals(10, e.getMaxCharacters()),
                () -> assertEquals(9, e.getIdAudio())
            );
        }
    }

    // ── LocationNeighborEntity ───────────────────────────────────────────────────

    @Nested
    @DisplayName("LocationNeighborEntity")
    class LocationNeighborEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: flagBack=0, energyCost=0")
        void prePersist_defaults() {
            LocationNeighborEntity e = new LocationNeighborEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(0, e.getFlagBack()),
                () -> assertEquals(0, e.getEnergyCost())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            LocationNeighborEntity e = new LocationNeighborEntity();
            e.setFlagBack(1);
            e.setEnergyCost(5);
            e.onCreate();
            assertAll(
                () -> assertEquals(1, e.getFlagBack()),
                () -> assertEquals(5, e.getEnergyCost())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            LocationNeighborEntity e = new LocationNeighborEntity();
            e.setId(1L);
            e.setIdStory(2L);
            e.setIdLocationFrom(3);
            e.setIdLocationTo(4);
            e.setDirection("NORTH");
            e.setFlagBack(1);
            e.setConditionRegistryKey("key");
            e.setConditionRegistryValue("val");
            e.setEnergyCost(5);
            e.setIdTextGo(6);
            e.setIdTextBack(7);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(3, e.getIdLocationFrom()),
                () -> assertEquals(4, e.getIdLocationTo()),
                () -> assertEquals("NORTH", e.getDirection()),
                () -> assertEquals(1, e.getFlagBack()),
                () -> assertEquals("key", e.getConditionRegistryKey()),
                () -> assertEquals("val", e.getConditionRegistryValue()),
                () -> assertEquals(5, e.getEnergyCost())
            );
        }
    }

    // ── MissionEntity ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("MissionEntity")
    class MissionEntityTests {

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            MissionEntity e = new MissionEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setConditionKey("QUEST_FLAG");
            e.setConditionValueFrom("0");
            e.setConditionValueTo("1");
            e.setIdTextName(4);
            e.setIdTextDescription(5);
            e.setIdEventCompleted(6);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals("QUEST_FLAG", e.getConditionKey()),
                () -> assertEquals("0", e.getConditionValueFrom()),
                () -> assertEquals("1", e.getConditionValueTo()),
                () -> assertEquals(6, e.getIdEventCompleted())
            );
        }
    }

    // ── MissionStepEntity ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("MissionStepEntity")
    class MissionStepEntityTests {

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            MissionStepEntity e = new MissionStepEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdMission(4);
            e.setIdTextName(5);
            e.setIdTextDescription(6);
            e.setStep(2);
            e.setConditionKey("QUEST");
            e.setConditionValueFrom("0");
            e.setConditionValueTo("1");
            e.setIdEventCompleted(7);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(4, e.getIdMission()),
                () -> assertEquals(2, e.getStep()),
                () -> assertEquals("QUEST", e.getConditionKey()),
                () -> assertEquals("0", e.getConditionValueFrom()),
                () -> assertEquals("1", e.getConditionValueTo()),
                () -> assertEquals(7, e.getIdEventCompleted())
            );
        }
    }

    // ── StoryDifficultyEntity ────────────────────────────────────────────────────

    @Nested
    @DisplayName("StoryDifficultyEntity")
    class StoryDifficultyEntityTests {

        @Test
        @DisplayName("@PrePersist sets non-zero defaults: expCost=5, maxWeight=10, minCharacter=1, maxCharacter=4, costs=3, freeActions=1")
        void prePersist_defaults() {
            StoryDifficultyEntity e = new StoryDifficultyEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(5, e.getExpCost()),
                () -> assertEquals(10, e.getMaxWeight()),
                () -> assertEquals(1, e.getMinCharacter()),
                () -> assertEquals(4, e.getMaxCharacter()),
                () -> assertEquals(3, e.getCostHelpComa()),
                () -> assertEquals(3, e.getCostMaxCharacteristics()),
                () -> assertEquals(1, e.getNumberMaxFreeAction())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            StoryDifficultyEntity e = new StoryDifficultyEntity();
            e.setExpCost(100);
            e.setMaxWeight(50);
            e.setMinCharacter(2);
            e.setMaxCharacter(8);
            e.setCostHelpComa(10);
            e.setCostMaxCharacteristics(5);
            e.setNumberMaxFreeAction(3);
            e.onCreate();
            assertAll(
                () -> assertEquals(100, e.getExpCost()),
                () -> assertEquals(50, e.getMaxWeight()),
                () -> assertEquals(2, e.getMinCharacter()),
                () -> assertEquals(8, e.getMaxCharacter()),
                () -> assertEquals(10, e.getCostHelpComa()),
                () -> assertEquals(5, e.getCostMaxCharacteristics()),
                () -> assertEquals(3, e.getNumberMaxFreeAction())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            StoryDifficultyEntity e = new StoryDifficultyEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdTextDescription(4);
            e.setExpCost(100);
            e.setMaxWeight(50);
            e.setMinCharacter(1);
            e.setMaxCharacter(4);
            e.setCostHelpComa(10);
            e.setCostMaxCharacteristics(5);
            e.setNumberMaxFreeAction(3);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(100, e.getExpCost()),
                () -> assertEquals(50, e.getMaxWeight()),
                () -> assertEquals(1, e.getMinCharacter()),
                () -> assertEquals(4, e.getMaxCharacter()),
                () -> assertEquals(10, e.getCostHelpComa()),
                () -> assertEquals(5, e.getCostMaxCharacteristics()),
                () -> assertEquals(3, e.getNumberMaxFreeAction())
            );
        }
    }

    // ── StoryEntity ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("StoryEntity")
    class StoryEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: visibility=PUBLIC, priority=0, peghi=0, clock descriptions")
        void prePersist_defaults() {
            StoryEntity e = new StoryEntity();
            e.baseOnCreate(); // sets uuid/ts
            e.onCreate();     // sets story-specific defaults
            assertAll(
                () -> assertEquals("PUBLIC", e.getVisibility()),
                () -> assertEquals(0, e.getPriority()),
                () -> assertEquals(0, e.getPeghi()),
                () -> assertEquals(10, e.getIdTextClockSingular()),
                () -> assertEquals(11, e.getIdTextClockPlural())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwriteExplicit() {
            StoryEntity e = new StoryEntity();
            e.setVisibility("PRIVATE");
            e.setPriority(5);
            e.setPeghi(200);
            e.setIdTextClockSingular(100);
            e.setIdTextClockPlural(101);
            e.onCreate();
            assertAll(
                () -> assertEquals("PRIVATE", e.getVisibility()),
                () -> assertEquals(5, e.getPriority()),
                () -> assertEquals(200, e.getPeghi()),
                () -> assertEquals(100, e.getIdTextClockSingular()),
                () -> assertEquals(101, e.getIdTextClockPlural())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            StoryEntity e = new StoryEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdTextTitle(3);
            e.setIdTextDescription(4);
            e.setAuthor("Author");
            e.setVersionMin("1.0");
            e.setVersionMax("2.0");
            e.setIdLocationStart(5);
            e.setIdImage(6);
            e.setIdLocationAllPlayerComa(7);
            e.setIdEventAllPlayerComa(8);
            e.setIdTextClockSingular(100);
            e.setIdTextClockPlural(101);
            e.setIdEventEndGame(9);
            e.setIdTextCopyright(10);
            e.setLinkCopyright("https://copy.com");
            e.setIdCreator(11);
            e.setCategory("RPG");
            e.setGroup("Fantasy");
            e.setVisibility("PUBLIC");
            e.setPriority(3);
            e.setPeghi(200);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals("Author", e.getAuthor()),
                () -> assertEquals("1.0", e.getVersionMin()),
                () -> assertEquals("2.0", e.getVersionMax()),
                () -> assertEquals(100, e.getIdTextClockSingular()),
                () -> assertEquals(101, e.getIdTextClockPlural()),
                () -> assertEquals("RPG", e.getCategory()),
                () -> assertEquals("Fantasy", e.getGroup()),
                () -> assertEquals("PUBLIC", e.getVisibility()),
                () -> assertEquals(3, e.getPriority()),
                () -> assertEquals(200, e.getPeghi())
            );
        }
    }

    // ── TextEntity ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("TextEntity")
    class TextEntityTests {

        @Test
        @DisplayName("@PrePersist sets default lang='en'")
        void prePersist_defaults() {
            TextEntity e = new TextEntity();
            e.onCreate();
            assertEquals("en", e.getLang());
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set lang")
        void prePersist_doesNotOverwrite() {
            TextEntity e = new TextEntity();
            e.setLang("it");
            e.onCreate();
            assertEquals("it", e.getLang());
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            TextEntity e = new TextEntity();
            e.setId(1L);
            e.setIdStory(2L);
            e.setIdText(3);
            e.setLang("it");
            e.setShortText("short");
            e.setLongText("long description");
            e.setIdTextCopyright(4);
            e.setLinkCopyright("https://copy.com");
            e.setIdCreator(5);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(3, e.getIdText()),
                () -> assertEquals("it", e.getLang()),
                () -> assertEquals("short", e.getShortText()),
                () -> assertEquals("long description", e.getLongText()),
                () -> assertEquals(4, e.getIdTextCopyright()),
                () -> assertEquals("https://copy.com", e.getLinkCopyright()),
                () -> assertEquals(5, e.getIdCreator())
            );
        }
    }

    // ── TraitEntity ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("TraitEntity")
    class TraitEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: costPositive=0, costNegative=0")
        void prePersist_defaults() {
            TraitEntity e = new TraitEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(0, e.getCostPositive()),
                () -> assertEquals(0, e.getCostNegative())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            TraitEntity e = new TraitEntity();
            e.setCostPositive(10);
            e.setCostNegative(5);
            e.onCreate();
            assertAll(
                () -> assertEquals(10, e.getCostPositive()),
                () -> assertEquals(5, e.getCostNegative())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            TraitEntity e = new TraitEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdClassPermitted(4);
            e.setIdClassProhibited(5);
            e.setIdTextName(6);
            e.setIdTextDescription(7);
            e.setCostPositive(10);
            e.setCostNegative(5);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(4, e.getIdClassPermitted()),
                () -> assertEquals(5, e.getIdClassProhibited()),
                () -> assertEquals(10, e.getCostPositive()),
                () -> assertEquals(5, e.getCostNegative())
            );
        }
    }

    // ── WeatherRuleEntity ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("WeatherRuleEntity")
    class WeatherRuleEntityTests {

        @Test
        @DisplayName("@PrePersist sets defaults: probability=0, moveCosts=0, active=1, priority=0, deltaEnergy=0")
        void prePersist_defaults() {
            WeatherRuleEntity e = new WeatherRuleEntity();
            e.onCreate();
            assertAll(
                () -> assertEquals(0, e.getProbability()),
                () -> assertEquals(0, e.getCostMoveSafeLocation()),
                () -> assertEquals(0, e.getCostMoveNotSafeLocation()),
                () -> assertEquals(1, e.getActive()),
                () -> assertEquals(0, e.getPriority()),
                () -> assertEquals(0, e.getDeltaEnergy())
            );
        }

        @Test
        @DisplayName("@PrePersist does NOT overwrite explicitly set values")
        void prePersist_doesNotOverwrite() {
            WeatherRuleEntity e = new WeatherRuleEntity();
            e.setProbability(30);
            e.setCostMoveSafeLocation(1);
            e.setCostMoveNotSafeLocation(3);
            e.setActive(0);
            e.setPriority(2);
            e.setDeltaEnergy(-5);
            e.onCreate();
            assertAll(
                () -> assertEquals(30, e.getProbability()),
                () -> assertEquals(1, e.getCostMoveSafeLocation()),
                () -> assertEquals(3, e.getCostMoveNotSafeLocation()),
                () -> assertEquals(0, e.getActive()),
                () -> assertEquals(2, e.getPriority()),
                () -> assertEquals(-5, e.getDeltaEnergy())
            );
        }

        @Test
        @DisplayName("Getters and setters round-trip correctly")
        void gettersSetters() {
            WeatherRuleEntity e = new WeatherRuleEntity();
            e.setId(1L);
            e.setIdCard(2);
            e.setIdStory(3L);
            e.setIdTextName(4);
            e.setIdTextDescription(5);
            e.setProbability(30);
            e.setCostMoveSafeLocation(1);
            e.setCostMoveNotSafeLocation(3);
            e.setConditionKey("WEATHER");
            e.setConditionKeyValue("STORM");
            e.setTimeFrom(6);
            e.setTimeTo(18);
            e.setIdText(6);
            e.setActive(1);
            e.setPriority(2);
            e.setDeltaEnergy(-5);
            e.setIdEvent(7);

            assertAll(
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals(30, e.getProbability()),
                () -> assertEquals(1, e.getCostMoveSafeLocation()),
                () -> assertEquals(3, e.getCostMoveNotSafeLocation()),
                () -> assertEquals("WEATHER", e.getConditionKey()),
                () -> assertEquals("STORM", e.getConditionKeyValue()),
                () -> assertEquals(6, e.getTimeFrom()),
                () -> assertEquals(18, e.getTimeTo()),
                () -> assertEquals(1, e.getActive()),
                () -> assertEquals(2, e.getPriority()),
                () -> assertEquals(-5, e.getDeltaEnergy()),
                () -> assertEquals(7, e.getIdEvent())
            );
        }
    }
}
