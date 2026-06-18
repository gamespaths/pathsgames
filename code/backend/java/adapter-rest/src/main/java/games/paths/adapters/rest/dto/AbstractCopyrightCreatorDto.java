package games.paths.adapters.rest.dto;

/**
 * Shared base DTO for REST responses that expose copyright attribution
 * ({@code copyrightText}, {@code linkCopyright}) plus the resolved
 * {@link CreatorInfoResponse}.
 *
 * <p>v0.20.8 — extracted from {@code CardInfoResponse} and
 * {@code TextInfoResponse} to drop the duplicated copyright/creator block
 * flagged by SonarQube (duplicated lines on new code). Subclasses keep their
 * own all-args constructors and delegate these three fields to
 * {@link #AbstractCopyrightCreatorDto(String, String, CreatorInfoResponse)}.</p>
 */
public abstract class AbstractCopyrightCreatorDto {

    private String copyrightText;
    private String linkCopyright;
    private CreatorInfoResponse creator;

    protected AbstractCopyrightCreatorDto() {
    }

    protected AbstractCopyrightCreatorDto(String copyrightText, String linkCopyright,
                                          CreatorInfoResponse creator) {
        this.copyrightText = copyrightText;
        this.linkCopyright = linkCopyright;
        this.creator = creator;
    }

    public String getCopyrightText() { return copyrightText; }
    public void setCopyrightText(String copyrightText) { this.copyrightText = copyrightText; }

    public String getLinkCopyright() { return linkCopyright; }
    public void setLinkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; }

    public CreatorInfoResponse getCreator() { return creator; }
    public void setCreator(CreatorInfoResponse creator) { this.creator = creator; }
}
