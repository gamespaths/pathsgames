package games.paths.core.service.story;

import games.paths.core.entity.story.CardEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.ClassBonusEntity;
import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CharacterTemplateInfo;
import games.paths.core.model.story.ClassBonusInfo;
import games.paths.core.model.story.ClassInfo;
import games.paths.core.model.story.DifficultyInfo;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.StorySummary;
import games.paths.core.model.story.TraitInfo;
import games.paths.core.port.story.StoryQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * StoryQueryService - Domain service implementing story querying.
 * Reads story data from the persistence layer and maps it to domain models.
 * Ports are injected via constructor by the launcher configuration.
 *
 * <p>Enhanced in Step 15 with category/group listing, filtering,
 * and enriched story detail with character templates, classes, traits, and card info.</p>
 */
public class StoryQueryService implements StoryQueryPort {

    private final StoryReadPort readPort;

    public StoryQueryService(StoryReadPort readPort) {
        this.readPort = readPort;
    }

    @Override
    public List<StorySummary> listPublicStories(String lang) {
        List<StoryEntity> stories = readPort.findStoriesByVisibility("PUBLIC");
        return mapToSummaries(stories, lang);
    }

    @Override
    public List<StorySummary> listAllStories(String lang) {
        List<StoryEntity> stories = readPort.findAllStories();
        return mapToSummaries(stories, lang);
    }

    @Override
    public StoryDetail getStoryByUuid(String uuid, String lang) {
        if (uuid == null || uuid.isBlank()) {
            return null;
        }

        Optional<StoryEntity> opt = readPort.findStoryByUuid(uuid);
        if (opt.isEmpty()) {
            return null;
        }

        StoryEntity story = opt.get();
        String title = resolveText(story.getId(), story.getIdTextTitle(), lang);
        String description = resolveText(story.getId(), story.getIdTextDescription(), lang);
        String copyrightText = resolveText(story.getId(), story.getIdTextCopyright(), lang);
        String clockSingular = resolveText(story.getId(), story.getIdTextClockSingular(), lang);
        String clockPlural = resolveText(story.getId(), story.getIdTextClockPlural(), lang);

        List<StoryDifficultyEntity> diffEntities = readPort.findDifficultiesByStoryId(story.getId());
        List<DifficultyInfo> difficulties = new ArrayList<>();
        for (StoryDifficultyEntity diff : diffEntities) {
            String diffDesc = resolveText(story.getId(), diff.getIdTextDescription(), lang);
            difficulties.add(DifficultyInfo.builder()
                    .uuid(diff.getUuid())
                    .description(diffDesc)
                    .expCost(diff.getExpCost() != null ? diff.getExpCost() : 5)
                    .maxWeight(diff.getMaxWeight() != null ? diff.getMaxWeight() : 10)
                    .minCharacter(diff.getMinCharacter() != null ? diff.getMinCharacter() : 1)
                    .maxCharacter(diff.getMaxCharacter() != null ? diff.getMaxCharacter() : 4)
                    .costHelpComa(diff.getCostHelpComa() != null ? diff.getCostHelpComa() : 3)
                    .costMaxCharacteristics(diff.getCostMaxCharacteristics() != null ? diff.getCostMaxCharacteristics() : 3)
                    .numberMaxFreeAction(diff.getNumberMaxFreeAction() != null ? diff.getNumberMaxFreeAction() : 1)
                    .life(diff.getLife() != null ? diff.getLife() : 100)
                    .energy(diff.getEnergy() != null ? diff.getEnergy() : 100)
                    .sad(diff.getSad() != null ? diff.getSad() : 0)
                    .dexterity(diff.getDexterity() != null ? diff.getDexterity() : 10)
                    .intelligence(diff.getIntelligence() != null ? diff.getIntelligence() : 10)
                    .constitution(diff.getConstitution() != null ? diff.getConstitution() : 10)
                    .weight(diff.getWeight() != null ? diff.getWeight() : 10)
                    .idCard(diff.getIdCard())
                    .card(resolveCardInfo(story.getId(), diff.getIdCard(), lang))
                    .traitCostPositiveBudget(diff.getTraitCostPositiveBudget())
                    .traitCostNegativeBudget(diff.getTraitCostNegativeBudget())
                    .build());
        }

        long locationCount = readPort.countLocationsByStoryId(story.getId());
        long eventCount = readPort.countEventsByStoryId(story.getId());
        long itemCount = readPort.countItemsByStoryId(story.getId());

        // Step 15: Character templates, classes, and traits
        List<CharacterTemplateEntity> ctEntities = readPort.findCharacterTemplatesByStoryId(story.getId());
        List<CharacterTemplateInfo> characterTemplates = new ArrayList<>();
        for (CharacterTemplateEntity ct : ctEntities) {
            String ctName = resolveText(story.getId(), ct.getIdTextName(), lang);
            String ctDesc = resolveText(story.getId(), ct.getIdTextDescription(), lang);
            characterTemplates.add(new CharacterTemplateInfo(
                    ct.getUuid(),
                    ctName,
                    ctDesc,
                    ct.getLifeMax() != null ? ct.getLifeMax() : 10,
                    ct.getEnergyMax() != null ? ct.getEnergyMax() : 10,
                    ct.getSadMax() != null ? ct.getSadMax() : 10,
                    ct.getDexterityStart() != null ? ct.getDexterityStart() : 1,
                    ct.getIntelligenceStart() != null ? ct.getIntelligenceStart() : 1,
                    ct.getConstitutionStart() != null ? ct.getConstitutionStart() : 1,
                    ct.getIdCard(),
                    resolveCardInfo(story.getId(), ct.getIdCard(), lang),
                    ct.getIdClassPermitted(),
                    ct.getIdClassProhibited()));
        }

        List<ClassEntity> classEntities = readPort.findClassesByStoryId(story.getId());
        List<ClassBonusEntity> classBonusEntities = readPort.findClassBonusesByStoryId(story.getId());
        List<ClassInfo> classes = new ArrayList<>();
        for (ClassEntity cl : classEntities) {
            String clName = resolveText(story.getId(), cl.getIdTextName(), lang);
            String clDesc = resolveText(story.getId(), cl.getIdTextDescription(), lang);
            List<ClassBonusInfo> bonusList = new ArrayList<>();
            for (ClassBonusEntity cb : classBonusEntities) {
                if (cb.getIdClass() != null && cl.getId() != null
                        && cb.getIdClass().longValue() == cl.getId().longValue()) {
                    bonusList.add(new ClassBonusInfo(
                            cb.getUuid(),
                            cb.getStatistic(),
                            cb.getValue() != null ? cb.getValue() : 0));
                }
            }
            classes.add(new ClassInfo(
                    cl.getId(),
                    cl.getUuid(),
                    clName,
                    clDesc,
                    cl.getWeightMax() != null ? cl.getWeightMax() : 10,
                    cl.getDexterityBase() != null ? cl.getDexterityBase() : 1,
                    cl.getIntelligenceBase() != null ? cl.getIntelligenceBase() : 1,
                    cl.getConstitutionBase() != null ? cl.getConstitutionBase() : 1,
                    cl.getIdCard(),
                    resolveCardInfo(story.getId(), cl.getIdCard(), lang),
                    bonusList));
        }

        List<TraitEntity> traitEntities = readPort.findTraitsByStoryId(story.getId());
        List<TraitInfo> traits = new ArrayList<>();
        for (TraitEntity tr : traitEntities) {
            traits.add(toTraitInfo(story.getId(), tr, lang));
        }

        // Step 15: Resolve card info
        CardInfo cardInfo = resolveCardInfo(story.getId(), story.getIdCard(), lang);

        return StoryDetail.builder()
                .uuid(story.getUuid())
                .title(title)
                .description(description)
                .author(story.getAuthor())
                .category(story.getCategory())
                .group(story.getGroup())
                .visibility(story.getVisibility())
                .priority(story.getPriority() != null ? story.getPriority() : 0)
                .peghi(story.getPeghi() != null ? story.getPeghi() : 0)
                .versionMin(story.getVersionMin())
                .versionMax(story.getVersionMax())
                .clockSingularDescription(clockSingular)
                .clockPluralDescription(clockPlural)
                .idTextClockSingular(story.getIdTextClockSingular())
                .idTextClockPlural(story.getIdTextClockPlural())
                .copyrightText(copyrightText)
                .linkCopyright(story.getLinkCopyright())
                .locationCount((int) locationCount)
                .eventCount((int) eventCount)
                .itemCount((int) itemCount)
                .classCount(classes.size())
                .characterTemplateCount(characterTemplates.size())
                .traitCount(traits.size())
                .difficulties(difficulties)
                .characterTemplates(characterTemplates)
                .classes(classes)
                .traits(traits)
                .card(cardInfo)
                .build();
    }

    // === Step 15: Category and Group queries ===

    @Override
    public List<String> listCategories() {
        return readPort.findDistinctCategoriesByVisibility("PUBLIC");
    }

    @Override
    public List<StorySummary> listStoriesByCategory(String category, String lang) {
        if (category == null || category.isBlank()) {
            return List.of();
        }
        List<StoryEntity> stories = readPort.findStoriesByCategoryAndVisibility(category, "PUBLIC");
        return mapToSummaries(stories, lang);
    }

    @Override
    public List<String> listGroups() {
        return readPort.findDistinctGroupsByVisibility("PUBLIC");
    }

    @Override
    public List<StorySummary> listStoriesByGroup(String group, String lang) {
        if (group == null || group.isBlank()) {
            return List.of();
        }
        List<StoryEntity> stories = readPort.findStoriesByGroupAndVisibility(group, "PUBLIC");
        return mapToSummaries(stories, lang);
    }

    // === Step 23: Trait listing filtered by class ===

    @Override
    public TraitsForClassResult listTraitsForClass(String storyUuid, String classUuid, String lang) {
        if (storyUuid == null || storyUuid.isBlank()) {
            return TraitsForClassResult.storyNotFound();
        }
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) {
            return TraitsForClassResult.storyNotFound();
        }
        StoryEntity story = storyOpt.get();

        if (classUuid == null || classUuid.isBlank()) {
            return TraitsForClassResult.classNotFound();
        }
        Optional<ClassEntity> classOpt = readPort.findClassByStoryIdAndUuid(story.getId(), classUuid);
        if (classOpt.isEmpty()) {
            return TraitsForClassResult.classNotFound();
        }
        Long classId = classOpt.get().getId();

        List<TraitInfo> traits = new ArrayList<>();
        for (TraitEntity tr : readPort.findTraitsByStoryId(story.getId())) {
            if (isTraitSelectableForClass(tr, classId)) {
                traits.add(toTraitInfo(story.getId(), tr, lang));
            }
        }
        return TraitsForClassResult.ok(traits);
    }

    private static boolean isTraitSelectableForClass(TraitEntity tr, Long classId) {
        Integer permitted = tr.getIdClassPermitted();
        Integer prohibited = tr.getIdClassProhibited();
        boolean permittedOk = permitted == null
                || (classId != null && permitted.longValue() == classId);
        boolean prohibitedOk = prohibited == null
                || classId == null || prohibited.longValue() != classId;
        return permittedOk && prohibitedOk;
    }

    // === Private helpers ===

    private TraitInfo toTraitInfo(Long storyId, TraitEntity tr, String lang) {
        String trName = resolveText(storyId, tr.getIdTextName(), lang);
        String trDesc = resolveText(storyId, tr.getIdTextDescription(), lang);
        return TraitInfo.builder()
                .uuid(tr.getUuid())
                .name(trName)
                .description(trDesc)
                .costPositive(tr.getCostPositive() != null ? tr.getCostPositive() : 0)
                .costNegative(tr.getCostNegative() != null ? tr.getCostNegative() : 0)
                .idClassPermitted(tr.getIdClassPermitted())
                .idClassProhibited(tr.getIdClassProhibited())
                .idCard(tr.getIdCard())
                .card(resolveCardInfo(storyId, tr.getIdCard(), lang))
                // v0.35.2 — reported on BOTH projections; nothing is filtered out here.
                .hideOnStartMatch(tr.isHiddenOnStartMatch())
                .life(tr.getLife() != null ? tr.getLife() : 0)
                .energy(tr.getEnergy() != null ? tr.getEnergy() : 0)
                .sad(tr.getSad() != null ? tr.getSad() : 0)
                .dexterity(tr.getDexterity() != null ? tr.getDexterity() : 0)
                .intelligence(tr.getIntelligence() != null ? tr.getIntelligence() : 0)
                .constitution(tr.getConstitution() != null ? tr.getConstitution() : 0)
                .weight(tr.getWeight() != null ? tr.getWeight() : 0)
                .build();
    }

    private List<StorySummary> mapToSummaries(List<StoryEntity> stories, String lang) {
        List<StorySummary> summaries = new ArrayList<>();
        for (StoryEntity story : stories) {
            String title = resolveText(story.getId(), story.getIdTextTitle(), lang);
            String description = resolveText(story.getId(), story.getIdTextDescription(), lang);

            List<StoryDifficultyEntity> diffs = readPort.findDifficultiesByStoryId(story.getId());
            CardInfo cardInfo = resolveCardInfo(story.getId(), story.getIdCard(), lang);

            summaries.add(new StorySummary(
                    story.getUuid(),
                    title,
                    description,
                    story.getAuthor(),
                    story.getCategory(),
                    story.getGroup(),
                    story.getVisibility(),
                    story.getPriority() != null ? story.getPriority() : 0,
                    story.getPeghi() != null ? story.getPeghi() : 0,
                    diffs.size(),
                    cardInfo));
        }
        return summaries;
    }

    /**
     * Resolves a text entry by story ID, text ID and language.
     * Falls back to "en" if the requested language is not found,
     * and returns null if no text exists at all.
     */
    private String resolveText(Long storyId, Integer idText, String lang) {
        if (idText == null) {
            return null;
        }
        String effectiveLang = (lang != null && !lang.isBlank()) ? lang : "en";

        Optional<TextEntity> text = readPort.findTextByStoryIdTextAndLang(storyId, idText, effectiveLang);
        if (text.isPresent()) {
            return text.get().getShortText();
        }

        // Fallback to English if requested lang not found
        if (!"en".equals(effectiveLang)) {
            Optional<TextEntity> fallback = readPort.findTextByStoryIdTextAndLang(storyId, idText, "en");
            if (fallback.isPresent()) {
                return fallback.get().getShortText();
            }
        }
        return null;
    }

    /**
     * Resolves card info from card entity, including text resolution for card title.
     */
    private CardInfo resolveCardInfo(Long storyId, Integer idCard, String lang) {
        if (idCard == null) {
            return null;
        }
        Optional<CardEntity> cardOpt = readPort.findCardByStoryIdAndCardId(storyId, idCard.longValue());
        if (cardOpt.isEmpty()) {
            return null;
        }
        CardEntity card = cardOpt.get();
        String cardTitle = resolveText(storyId, card.getIdTextTitle(), lang);
        String cardDescription = resolveText(storyId, card.getIdTextDescription(), lang);
        String cardCopyrightText = resolveText(storyId, card.getIdTextCopyright(), lang);
        return new CardInfo(
                card.getUuid(),
                card.getCardType(),
                card.getUrlImage(),
                card.getAlternativeImage(),
                card.getAwesomeIcon(),
                card.getStyleMain(),
                card.getStyleDetail(),
                card.getStyleImageLittle(),
                card.getStyleImageMedium(),
                card.getStyleImageLarge(),
                cardTitle,
                cardDescription,
                cardCopyrightText,
                card.getLinkCopyright(),
                null);
    }
}
