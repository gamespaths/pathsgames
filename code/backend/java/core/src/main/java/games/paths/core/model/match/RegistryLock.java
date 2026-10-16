package games.paths.core.model.match;

/**
 * RegistryLock - V1 step 1: why a registry condition blocks an event, choice or edge.
 * MISSING (wait for a value) or FORBIDDEN ({@code !=} matched); key fields null when hidden.
 */
public record RegistryLock(String mode,
                           boolean hidden,
                           String key,
                           String keyTitle,
                           String operator,
                           String value) {

    public static final String MODE_MISSING = "MISSING";
    public static final String MODE_FORBIDDEN = "FORBIDDEN";

    /** No key to show: choice OR aggregate or an authoring error. */
    public static RegistryLock generic() {
        return new RegistryLock(MODE_MISSING, false, null, null, null, null);
    }

    /** The same mode with every key field blanked: the key is not PUBLIC. */
    public RegistryLock asHidden() {
        return new RegistryLock(mode, true, null, null, null, null);
    }

    public RegistryLock withKeyTitle(String title) {
        return new RegistryLock(mode, hidden, key, title, operator, value);
    }
}
