package games.paths.adapters.rest.dto;

/**
 * MatchCreateRequest - Request body for {@code POST /api/matches}.
 * Step 19 — single-player match creation.
 *
 * <p>Step 0.19.9 — the request now carries the full creator loadout: the
 * selected character template, class, trait uuids and a single-player flag
 * ({@code 1} single-player, {@code 0} multiplayer). All loadout fields are
 * optional; {@code storyUuid} and {@code difficultyUuid} stay mandatory.</p>
 *
 * <p>v0.20.8 — {@code name} and the loadout fields moved to
 * {@link AbstractCreatorLoadoutDto} to drop duplicated lines flagged by
 * SonarQube. The inherited {@code uuid} accessor is unused on this request.</p>
 */
public class MatchCreateRequest extends AbstractCreatorLoadoutDto {

    private String storyUuid;
    private String difficultyUuid;
    private String turnstileToken;
    /** Step 27 — optional deterministic RNG seed for weather/probability rolls. */
    private Long rngSeed;

    public MatchCreateRequest() {
    }

    public String getStoryUuid() { return storyUuid; }
    public void setStoryUuid(String storyUuid) { this.storyUuid = storyUuid; }

    public String getDifficultyUuid() { return difficultyUuid; }
    public void setDifficultyUuid(String difficultyUuid) { this.difficultyUuid = difficultyUuid; }

    public String getTurnstileToken() { return turnstileToken; }
    public void setTurnstileToken(String turnstileToken) { this.turnstileToken = turnstileToken; }

    public Long getRngSeed() { return rngSeed; }
    public void setRngSeed(Long rngSeed) { this.rngSeed = rngSeed; }
}
