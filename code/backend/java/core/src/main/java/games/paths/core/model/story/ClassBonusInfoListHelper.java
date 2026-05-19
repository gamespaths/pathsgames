package games.paths.core.model.story;

import java.util.List;

/**
 * Internal helper for null-safe immutable list copies used by the story
 * record models ({@code ClassInfo}, {@code StoryDetail}).
 */
final class ClassBonusInfoListHelper {

    private ClassBonusInfoListHelper() {
    }

    static <T> List<T> immutableCopy(List<T> source) {
        return source != null ? List.copyOf(source) : List.of();
    }
}
