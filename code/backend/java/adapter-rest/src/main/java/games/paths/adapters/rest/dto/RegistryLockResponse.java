package games.paths.adapters.rest.dto;

import games.paths.core.model.match.RegistryLock;

/**
 * RegistryLockResponse - V1 step 1, the shared {@code RegistryLock} schema on events, neighbors
 * and pending choices. Key fields are null when {@code hidden}, or when no key can be named.
 */
public class RegistryLockResponse {

    private String mode;
    private boolean hidden;
    private String key;
    private String keyTitle;
    private String operator;
    private String value;

    /** Null in, null out: the field stays null on anything not blocked by the registry. */
    public static RegistryLockResponse fromModel(RegistryLock m) {
        if (m == null) {
            return null;
        }
        RegistryLockResponse d = new RegistryLockResponse();
        d.mode = m.mode();
        d.hidden = m.hidden();
        d.key = m.key();
        d.keyTitle = m.keyTitle();
        d.operator = m.operator();
        d.value = m.value();
        return d;
    }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public boolean isHidden() { return hidden; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }
    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getKeyTitle() { return keyTitle; }
    public void setKeyTitle(String keyTitle) { this.keyTitle = keyTitle; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
}
