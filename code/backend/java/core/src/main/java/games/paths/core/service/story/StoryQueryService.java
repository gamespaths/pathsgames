package games.paths.core.service.story;

import games.paths.core.entity.story.CardEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CharacterTemplateInfo;
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
            characterTemplates.add(CharacterTemplateInfo.builder()
                    .uuid(ct.getUuid())
                    .name(ctName)
                    .description(ctDesc)
                    .lifeMax(ct.getLifeMax() != null ? ct.getLifeMax() : 10)
                    .energyMax(ct.getEnergyMax() != null ? ct.getEnergyMax() : 10)
                    .sadMax(ct.getSadMax() != null ? ct.getSadMax() : 10)
                    .dexterityStart(ct.getDexterityStart() != null ? ct.getDexterityStart() : 1)
                    .intelligenceStart(ct.getIntelligenceStart() != null ? ct.getIntelligenceStart() : 1)
                    .constitutionStart(ct.getConstitutionStart() != null ? ct.getConstitutionStart() : 1)
                    .build());
        }

        List<ClassEntity> classEntities = readPort.findClassesByStoryId(story.getId());
        List<ClassInfo> classes = new ArrayList<>();
        for (ClassEntity cl : classEntities) {
            String clName = resolveText(story.getId(), cl.getIdTextName(), lang);
            String clDesc = resolveText(story.getId(), cl.getIdTextDescription(), lang);
            classes.add(ClassInfo.builder()
                    .uuid(cl.getUuid())
                    .name(clName)
                    .description(clDesc)
                    .weightMax(cl.getWeightMax() != null ? cl.getWeightMax() : 10)
                    .dexterityBase(cl.getDexterityBase() != null ? cl.getDexterityBase() : 1)
                    .intelligenceBase(cl.getIntelligenceBase() != null ? cl.getIntelligenceBase() : 1)
                    .constitutionBase(cl.getConstitutionBase() != null ? cl.getConstitutionBase() : 1)
                    .build());
        }

        List<TraitEntity> traitEntities = readPort.findTraitsByStoryId(story.getId());
        List<TraitInfo> traits = new ArrayList<>();
        for (TraitEntity tr : traitEntities) {
            String trName = resolveText(story.getId(), tr.getIdTextName(), lang);
            String trDesc = resolveText(story.getId(), tr.getIdTextDescription(), lang);
            traits.add(TraitInfo.builder()
                    .uuid(tr.getUuid())
                    .name(trName)
                    .description(trDesc)
                    .costPositive(tr.getCostPositive() != null ? tr.getCostPositive() : 0)
                    .costNegative(tr.getCostNegative() != null ? tr.getCostNegative() : 0)
                    .idClassPermitted(tr.getIdClassPermitted())
                    .idClassProhibited(tr.getIdClassProhibited())
                    .build());
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
                .clockSingularDescription(story.getClockSingularDescription())
                .clockPluralDescription(story.getClockPluralDescription())
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

    // === Private helpers ===

    private List<StorySummary> mapToSummaries(List<StoryEntity> stories, String lang) {
        List<StorySummary> summaries = new ArrayList<>();
        for (StoryEntity story : stories) {
            String title = resolveText(story.getId(), story.getIdTextTitle(), lang);
            String description = resolveText(story.getId(), story.getIdTextDescription(), lang);

            List<StoryDifficultyEntity> diffs = readPort.findDifficultiesByStoryId(story.getId());

            summaries.add(StorySummary.builder()
                    .uuid(story.getUuid())
                    .title(title)
                    .description(description)
                    .author(story.getAuthor())
                    .category(story.getCategory())
                    .group(story.getGroup())
                    .visibility(story.getVisibility())
                    .priority(story.getPriority() != null ? story.getPriority() : 0)
                    .peghi(story.getPeghi() != null ? story.getPeghi() : 0)
                    .difficultyCount(diffs.size())
                    .build());
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
        return CardInfo.builder()
                .uuid(card.getUuid())
                .imageUrl(card.getUrlImmage())
                .alternativeImage(card.getAlternativeImage())
                .awesomeIcon(card.getAwesomeIcon())
                .styleMain(card.getStyleMain())
                .styleDetail(card.getStyleDetail())
                .description(cardDescription)
                .title(cardTitle)
                .copyrightText(cardCopyrightText)
                .linkCopyright(card.getLinkCopyright())
                .build();
    }
}
