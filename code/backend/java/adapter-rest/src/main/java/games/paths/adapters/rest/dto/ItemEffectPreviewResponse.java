package games.paths.adapters.rest.dto;

import games.paths.core.model.match.ItemEffectPreview;

import java.util.ArrayList;
import java.util.List;

/**
 * JSON projection of {@link ItemEffectPreview}: what using an item promises, one row per
 * {@code list_items_effects} entry. Step 35.
 *
 * <p>Field names match the {@code AppliedEffect} pair {@code statistic}/{@code value} the
 * execute-event answer already uses, so the board reads a promise and a result with the
 * same code ({@code effectStatItems}).</p>
 */
public class ItemEffectPreviewResponse {

    private String statistic;
    private Integer value;

    public static ItemEffectPreviewResponse fromModel(ItemEffectPreview m) {
        ItemEffectPreviewResponse r = new ItemEffectPreviewResponse();
        r.statistic = m.getStatistic();
        r.value = m.getValue();
        return r;
    }

    /** Null in, empty out: the board iterates {@code effects[]} without a null check. */
    public static List<ItemEffectPreviewResponse> fromModels(List<ItemEffectPreview> models) {
        List<ItemEffectPreviewResponse> out = new ArrayList<>();
        if (models == null) {
            return out;
        }
        for (ItemEffectPreview m : models) {
            if (m != null) {
                out.add(fromModel(m));
            }
        }
        return out;
    }

    public String getStatistic() { return statistic; }
    public void setStatistic(String statistic) { this.statistic = statistic; }
    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }
}
