package games.paths.core.model.auth;

import java.util.List;

/** AdminUserPage - v1.7.0 one page of GET /api/admin/users: the cursor envelope {items, nextCursor, limit}. */
public record AdminUserPage(List<AdminUserItem> items, String nextCursor, int limit) {
}
