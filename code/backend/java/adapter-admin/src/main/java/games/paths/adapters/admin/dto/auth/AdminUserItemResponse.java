package games.paths.adapters.admin.dto.auth;

import games.paths.core.model.auth.AdminUserItem;
import games.paths.core.model.auth.AdminUserPage;

import java.util.List;

/** AdminUserItemResponse - v1.7.0 one row of GET /api/admin/users (no email) and the page envelope. */
public record AdminUserItemResponse(String uuid, String nickname, int state, String role, String accountType,
                                    String tsRegistration, String tsLastAccess, String suspendedUntil) {

    public static AdminUserItemResponse of(AdminUserItem i) {
        return new AdminUserItemResponse(i.uuid(), i.nickname(), i.state(), i.role(), i.accountType(),
                i.tsRegistration(), i.tsLastAccess(), i.suspendedUntil());
    }

    /** The cursor envelope {items, nextCursor, limit}. */
    public record Page(List<AdminUserItemResponse> items, String nextCursor, int limit) {

        public static Page of(AdminUserPage p) {
            return new Page(p.items().stream().map(AdminUserItemResponse::of).toList(), p.nextCursor(), p.limit());
        }
    }
}
