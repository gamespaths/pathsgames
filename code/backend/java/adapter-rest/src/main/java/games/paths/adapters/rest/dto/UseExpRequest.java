package games.paths.adapters.rest.dto;

/** Body of POST /api/gameplay/{uuidMatch}/action/use-exp (Step 38): the stat to raise, dex|int|cos. */
public class UseExpRequest {

    private String stat;

    public String getStat() { return stat; }
    public void setStat(String stat) { this.stat = stat; }
}
