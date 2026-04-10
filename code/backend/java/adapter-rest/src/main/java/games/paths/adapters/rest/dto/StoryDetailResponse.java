package games.paths.adapters.rest.dto;

import java.util.List;

/**
 * StoryDetailResponse - REST response DTO for full story details.
 */
public class StoryDetailResponse {

    private String uuid;
    private String title;
    private String description;
    private String author;
    private String category;
    private String group;
    private String visibility;
    private int priority;
    private int peghi;
    private String versionMin;
    private String versionMax;
    private String clockSingularDescription;
    private String clockPluralDescription;
    private String copyrightText;
    private String linkCopyright;
    private int locationCount;
    private int eventCount;
    private int itemCount;
    private List<DifficultyResponse> difficulties;

    public StoryDetailResponse() {}

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }

    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }

    public int getPeghi() { return peghi; }
    public void setPeghi(int peghi) { this.peghi = peghi; }

    public String getVersionMin() { return versionMin; }
    public void setVersionMin(String versionMin) { this.versionMin = versionMin; }

    public String getVersionMax() { return versionMax; }
    public void setVersionMax(String versionMax) { this.versionMax = versionMax; }

    public String getClockSingularDescription() { return clockSingularDescription; }
    public void setClockSingularDescription(String clockSingularDescription) { this.clockSingularDescription = clockSingularDescription; }

    public String getClockPluralDescription() { return clockPluralDescription; }
    public void setClockPluralDescription(String clockPluralDescription) { this.clockPluralDescription = clockPluralDescription; }

    public String getCopyrightText() { return copyrightText; }
    public void setCopyrightText(String copyrightText) { this.copyrightText = copyrightText; }

    public String getLinkCopyright() { return linkCopyright; }
    public void setLinkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; }

    public int getLocationCount() { return locationCount; }
    public void setLocationCount(int locationCount) { this.locationCount = locationCount; }

    public int getEventCount() { return eventCount; }
    public void setEventCount(int eventCount) { this.eventCount = eventCount; }

    public int getItemCount() { return itemCount; }
    public void setItemCount(int itemCount) { this.itemCount = itemCount; }

    public List<DifficultyResponse> getDifficulties() { return difficulties; }
    public void setDifficulties(List<DifficultyResponse> difficulties) { this.difficulties = difficulties; }
}
