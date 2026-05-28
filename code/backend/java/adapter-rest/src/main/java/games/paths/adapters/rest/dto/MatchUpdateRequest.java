package games.paths.adapters.rest.dto;

/**
 * MatchUpdateRequest - request body for {@code PUT /api/admin/matches/{uuid}}.
 *
 * <p>Both fields are optional; a {@code null} field leaves the current value
 * unchanged. At least one must be provided.</p>
 */
public class MatchUpdateRequest {

    private String status;
    private String name;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
