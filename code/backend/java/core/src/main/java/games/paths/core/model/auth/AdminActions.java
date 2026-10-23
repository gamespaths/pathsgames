package games.paths.core.model.auth;

/**
 * AdminActions - v1.7.0 the actions of the admin intervention log; SYSTEM is the admin of an automatic
 * action (the unblock at the end of a suspension). Reason at most 500 characters, never personal data.
 */
public final class AdminActions {

    public static final String BAN = "BAN";
    public static final String SUSPEND = "SUSPEND";
    public static final String UNBLOCK = "UNBLOCK";
    public static final String RELINK_SUBJECT = "RELINK_SUBJECT";
    public static final String DELETE_OLD_USER = "DELETE_OLD_USER";
    public static final String SYSTEM = "SYSTEM";
    public static final int REASON_MAX = 500;
    public static final int RETENTION_MONTHS = 24;

    private AdminActions() {
    }
}
