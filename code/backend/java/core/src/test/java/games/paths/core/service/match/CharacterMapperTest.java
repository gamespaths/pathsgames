package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.ItemInstanceInfo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Unit tests for {@link CharacterMapper} — the null-safety of the carried-weight
 * sum, whose item list is nullable at the call site.
 */
class CharacterMapperTest {

    private static GamingCharacterInstanceEntity character() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setUuid("char-uuid");
        return c;
    }

    private static ItemInstanceInfo item(Integer weight, Integer amount) {
        ItemInstanceInfo i = new ItemInstanceInfo();
        i.setWeight(weight);
        i.setAmount(amount);
        return i;
    }

    @Test
    @DisplayName("a null item list weighs 0 and becomes an empty list")
    void nullItemsWeighNothing() {
        CharacterInstanceInfo info = CharacterMapper.build(
                character(), "match-uuid", "user-uuid", Map.of(), null, null, null, null);

        assertEquals(0, info.getWeight());
        assertNotNull(info.getItems());
        assertEquals(0, info.getItems().size());
    }

    @Test
    @DisplayName("weight is the sum of weight × amount, with null weight 0 and null amount 1")
    void weightSumsOverItems() {
        List<ItemInstanceInfo> items = List.of(
                item(3, 2),        // 6
                item(5, null),     // 5 — a null amount counts as one
                item(null, 4));    // 0 — a null weight adds nothing

        CharacterInstanceInfo info = CharacterMapper.build(
                character(), "match-uuid", "user-uuid", Map.of(), null, null, items, null);

        assertEquals(11, info.getWeight());
        assertEquals(3, info.getItems().size());
    }
}
