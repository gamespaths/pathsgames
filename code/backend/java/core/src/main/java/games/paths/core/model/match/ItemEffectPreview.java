package games.paths.core.model.match;

/**
 * ItemEffectPreview - one {@code list_items_effects} row, as the board is allowed to read
 * it BEFORE the item is used. Step 35.
 *
 * <p>Until this version an item's effects reached the client only in the answer of
 * {@code use-item} — that is, once the row was already spent. The player could therefore
 * never tell a healing potion from a poison until they drank it. This model is the
 * "before" reading of the very same rows {@code InventoryService.standaloneEffects}
 * applies, so the two can never describe different effects.</p>
 *
 * <p>Deliberately narrow: the statistic and the value, nothing else. The trait CSVs are
 * left out (resolving them into localised names is a second lookup, and a trait is not a
 * number the board can badge), and so is the effect's own narrative card, which is the
 * story of what happened and belongs to the answer, not to the promise.</p>
 *
 * <p>The statistic is already normalised through {@link EffectStatCodec}: the client
 * receives {@code sad}, never {@code SADNESS}. The value is the authored one, BEFORE the
 * engine clamps it — the same reading {@code effectStatItems} gives an
 * {@code AppliedEffect} — so a {@code -10} life on a character with 3 left promises -10
 * and delivers -3. That is the effect as written, which is what a promise can honestly
 * be.</p>
 */
public class ItemEffectPreview {

    private String statistic;
    private Integer value;

    public ItemEffectPreview() {
    }

    public ItemEffectPreview(String statistic, Integer value) {
        this.statistic = statistic;
        this.value = value;
    }

    public String getStatistic() { return statistic; }
    public void setStatistic(String statistic) { this.statistic = statistic; }

    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }
}
