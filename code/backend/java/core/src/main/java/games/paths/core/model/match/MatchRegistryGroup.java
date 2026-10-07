package games.paths.core.model.match;

import java.util.List;

/**
 * MatchRegistryGroup - Step 36. The registry keys of a match grouped by the category their
 * {@code list_keys} definition gives them; a key with no group falls into the null category.
 */
public record MatchRegistryGroup(String category, List<MatchRegistryEntry> entries) {
}
