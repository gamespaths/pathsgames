package games.paths.adapters.rest.dto;

/**
 * TextInfoResponse - REST response DTO for a resolved text entry.
 *
 * <p>Added in Step 16.</p>
 *
 * <p>v0.20.8 — copyright/creator fields moved to
 * {@link AbstractCopyrightCreatorDto} to drop duplicated lines flagged by
 * SonarQube.</p>
 */
public class TextInfoResponse extends AbstractCopyrightCreatorDto {

    private int idText;
    private String lang;
    private String resolvedLang;
    private String shortText;
    private String longText;

    public TextInfoResponse() {}

    public TextInfoResponse(int idText, String lang, String resolvedLang,
                            String shortText, String longText,
                            String copyrightText, String linkCopyright,
                            CreatorInfoResponse creator) {
        super(copyrightText, linkCopyright, creator);
        this.idText = idText;
        this.lang = lang;
        this.resolvedLang = resolvedLang;
        this.shortText = shortText;
        this.longText = longText;
    }

    public int getIdText() { return idText; }
    public void setIdText(int idText) { this.idText = idText; }

    public String getLang() { return lang; }
    public void setLang(String lang) { this.lang = lang; }

    public String getResolvedLang() { return resolvedLang; }
    public void setResolvedLang(String resolvedLang) { this.resolvedLang = resolvedLang; }

    public String getShortText() { return shortText; }
    public void setShortText(String shortText) { this.shortText = shortText; }

    public String getLongText() { return longText; }
    public void setLongText(String longText) { this.longText = longText; }
}
