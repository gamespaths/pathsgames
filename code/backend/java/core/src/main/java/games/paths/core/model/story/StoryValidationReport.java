package games.paths.core.model.story;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * StoryValidationReport - accumulates {@link StoryValidationError}s produced while
 * validating a story's referential integrity and domain rules (Step 22).
 *
 * <p>A report is {@link #isValid() valid} when it holds no errors.</p>
 */
public class StoryValidationReport {

    private final List<StoryValidationError> errors = new ArrayList<>();

    /** Adds an error to the report. */
    public void add(String rule, String entityType, String entityId, String field, String message) {
        errors.add(new StoryValidationError(rule, entityType, entityId, field, message));
    }

    /** @return true when no errors were recorded. */
    public boolean isValid() {
        return errors.isEmpty();
    }

    /** @return an immutable view of the recorded errors. */
    public List<StoryValidationError> getErrors() {
        return Collections.unmodifiableList(errors);
    }

    /** @return the number of recorded errors. */
    public int size() {
        return errors.size();
    }

    /** @return a compact one-line summary listing up to the first five messages. */
    public String summary() {
        if (errors.isEmpty()) {
            return "story is valid";
        }
        String head = errors.stream()
                .limit(5)
                .map(StoryValidationError::message)
                .collect(Collectors.joining("; "));
        return errors.size() <= 5
                ? head
                : head + "; (+" + (errors.size() - 5) + " more)";
    }
}
