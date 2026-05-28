package games.paths.adapters.rest.dto;

/**
 * TextInfoResponse - REST response DTO for a resolved text entry.
 *
 * <p>Added in Step 16.</p>
 */
public class TextInfoResponse {

    private int idText;
    private String lang;
    private String resolvedLang;
    private String shortText;
    private String longText;
    private String copyrightText;
    private String linkCopyright;
    private CreatorInfoResponse creator;

    public TextInfoResponse() {}

    public TextInfoResponse(int idText, String lang, String resolvedLang,
                            String shortText, String longText,
                            String copyrightText, String linkCopyright,
                            CreatorInfoResponse creator) {
        this.idText = idText;
        this.lang = lang;
        this.resolvedLang = resolvedLang;
        this.shortText = shortText;
        this.longText = longText;
        this.copyrightText = copyrightText;
        this.linkCopyright = linkCopyright;
        this.creator = creator;
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

    public String getCopyrightText() { return copyrightText; }
    public void setCopyrightText(String copyrightText) { this.copyrightText = copyrightText; }

    public String getLinkCopyright() { return linkCopyright; }
    public void setLinkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; }

    public CreatorInfoResponse getCreator() { return creator; }
    public void setCreator(CreatorInfoResponse creator) { this.creator = creator; }
}
