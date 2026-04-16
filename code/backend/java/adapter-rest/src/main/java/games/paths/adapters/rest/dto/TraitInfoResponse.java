package games.paths.adapters.rest.dto;

/**
 * TraitInfoResponse - REST response DTO for a character trait.
 */
public class TraitInfoResponse {

    private String uuid;
    private String name;
    private String description;
    private int costPositive;
    private int costNegative;
    private Integer idClassPermitted;
    private Integer idClassProhibited;

    public TraitInfoResponse() {}

    public TraitInfoResponse(String uuid, String name, String description,
                             int costPositive, int costNegative,
                             Integer idClassPermitted, Integer idClassProhibited) {
        this.uuid = uuid;
        this.name = name;
        this.description = description;
        this.costPositive = costPositive;
        this.costNegative = costNegative;
        this.idClassPermitted = idClassPermitted;
        this.idClassProhibited = idClassProhibited;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public int getCostPositive() { return costPositive; }
    public void setCostPositive(int costPositive) { this.costPositive = costPositive; }

    public int getCostNegative() { return costNegative; }
    public void setCostNegative(int costNegative) { this.costNegative = costNegative; }

    public Integer getIdClassPermitted() { return idClassPermitted; }
    public void setIdClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; }

    public Integer getIdClassProhibited() { return idClassProhibited; }
    public void setIdClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; }
}
