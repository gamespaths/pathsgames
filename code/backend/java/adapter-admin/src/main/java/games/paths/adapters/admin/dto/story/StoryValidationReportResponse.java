package games.paths.adapters.admin.dto.story;

import games.paths.core.model.story.StoryValidationReport;

import java.util.List;
import java.util.stream.Collectors;

/**
 * StoryValidationReportResponse - body of {@code GET /api/admin/stories/{uuid}/validate}
 * and the {@code errors} array embedded in the 400 response on import / CRUD failure
 * (Step 22).
 */
public record StoryValidationReportResponse(
        boolean valid,
        int count,
        List<StoryValidationErrorResponse> errors) {

    public static StoryValidationReportResponse fromModel(StoryValidationReport report) {
        List<StoryValidationErrorResponse> list = report.getErrors().stream()
                .map(StoryValidationErrorResponse::fromModel)
                .collect(Collectors.toList());
        return new StoryValidationReportResponse(report.isValid(), list.size(), list);
    }
}
