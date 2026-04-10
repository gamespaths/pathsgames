package games.paths.core.service.story;

import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.model.story.DifficultyInfo;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.StorySummary;
import games.paths.core.port.story.StoryQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * StoryQueryService - Domain service implementing story querying.
 * Reads story data from the persistence layer and maps it to domain models.
 * Ports are injected via constructor by the launcher configuration.
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
                .difficulties(difficulties)
                .build();
    }

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
}
