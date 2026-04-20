package games.paths.core.model.story;

/**
 * TextInfo - Domain model for a resolved text entry.
 * Includes both short and long text, resolved language, and optional
 * copyright and creator information.
 *
 * <p>Added in Step 16 for the content detail APIs.</p>
 */
public class TextInfo {

    private final int idText;
    private final String lang;
    private final String resolvedLang;
    private final String shortText;
    private final String longText;
    private final String copyrightText;
    private final String linkCopyright;
    private final CreatorInfo creator;

    private TextInfo(Builder builder) {
        this.idText = builder.idText;
        this.lang = builder.lang;
        this.resolvedLang = builder.resolvedLang;
        this.shortText = builder.shortText;
        this.longText = builder.longText;
        this.copyrightText = builder.copyrightText;
        this.linkCopyright = builder.linkCopyright;
        this.creator = builder.creator;
    }

    public int getIdText() { return idText; }
    public String getLang() { return lang; }
    public String getResolvedLang() { return resolvedLang; }
    public String getShortText() { return shortText; }
    public String getLongText() { return longText; }
    public String getCopyrightText() { return copyrightText; }
    public String getLinkCopyright() { return linkCopyright; }
    public CreatorInfo getCreator() { return creator; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private int idText;
        private String lang;
        private String resolvedLang;
        private String shortText;
        private String longText;
        private String copyrightText;
        private String linkCopyright;
        private CreatorInfo creator;

        public Builder idText(int idText) { this.idText = idText; return this; }
        public Builder lang(String lang) { this.lang = lang; return this; }
        public Builder resolvedLang(String resolvedLang) { this.resolvedLang = resolvedLang; return this; }
        public Builder shortText(String shortText) { this.shortText = shortText; return this; }
        public Builder longText(String longText) { this.longText = longText; return this; }
        public Builder copyrightText(String copyrightText) { this.copyrightText = copyrightText; return this; }
        public Builder linkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; return this; }
        public Builder creator(CreatorInfo creator) { this.creator = creator; return this; }

        public TextInfo build() {
            return new TextInfo(this);
        }
    }

    @Override
    public String toString() {
        return "TextInfo{idText=" + idText + ", lang='" + lang + "', resolvedLang='" + resolvedLang + "'}";
    }
}
