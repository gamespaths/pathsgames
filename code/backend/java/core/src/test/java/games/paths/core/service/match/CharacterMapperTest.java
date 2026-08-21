package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.ItemEffectEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

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

    // === buildAll: the story-side lookups behind a match's character list ===

    private static GamingMatchEntity match(Long idStory) {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(1L);
        m.setUuid("match-uuid");
        m.setIdStory(idStory);
        return m;
    }

    private static GamingInventoryItemsEntity inventoryRow(String uuid, Long idItem, Integer amount) {
        GamingInventoryItemsEntity row = new GamingInventoryItemsEntity();
        row.setUuid(uuid);
        row.setIdItem(idItem);
        row.setAmount(amount);
        return row;
    }

    @Test
    @DisplayName("an empty character list maps to an empty result")
    void buildAllOnAnEmptyParty() {
        assertEquals(0, CharacterMapper.buildAll(List.of(), match(5L),
                mock(StoryReadPort.class), mock(CharacterReadPort.class), "user-uuid", 7L).size());
        assertEquals(0, CharacterMapper.buildAll(null, match(5L),
                mock(StoryReadPort.class), mock(CharacterReadPort.class), "user-uuid", 7L).size());
    }

    @Test
    @DisplayName("a match without a story resolves no story-side data at all")
    void buildAllWithoutAStory() {
        StoryReadPort storyReadPort = mock(StoryReadPort.class);
        CharacterReadPort characterReadPort = mock(CharacterReadPort.class);
        GamingCharacterInstanceEntity c = character();
        c.setId(10L);
        c.setIdUser(7L);
        when(characterReadPort.findBackpack(1L, 10L)).thenReturn(Optional.empty());
        when(characterReadPort.findTraits(1L, 10L)).thenReturn(List.of());
        when(characterReadPort.findInventory(1L, 10L)).thenReturn(null);

        CharacterInstanceInfo info = CharacterMapper.buildAll(List.of(c), match(null),
                storyReadPort, characterReadPort, "user-uuid", null).get(0);

        // requesterUserId null → the user uuid is never echoed back
        assertNull(info.getUserUuid());
        assertEquals(0, info.getItems().size());
        verifyNoInteractions(storyReadPort);
    }

    @Test
    @DisplayName("story data resolves item names, skips unknown traits and zeroes unknown items")
    void buildAllResolvesStoryData() {
        StoryReadPort storyReadPort = mock(StoryReadPort.class);
        CharacterReadPort characterReadPort = mock(CharacterReadPort.class);

        CharacterTemplateEntity template = new CharacterTemplateEntity();
        template.setIdTipo(3L);
        template.setUuid("template-uuid");
        TraitEntity trait = new TraitEntity();
        trait.setId(4L);
        trait.setUuid("trait-uuid");
        LocationEntity location = new LocationEntity();
        location.setId(6L);
        location.setUuid("loc-uuid");
        ItemEntity item = new ItemEntity();
        item.setId(8L);
        item.setUuid("item-uuid");
        item.setWeight(2);
        item.setIdTextName(99);
        when(storyReadPort.findCharacterTemplatesByStoryId(5L)).thenReturn(List.of(template));
        when(storyReadPort.findTraitsByStoryId(5L)).thenReturn(List.of(trait));
        when(storyReadPort.findLocationsByStoryId(5L)).thenReturn(List.of(location));
        when(storyReadPort.findItemsByStoryId(5L)).thenReturn(List.of(item));
        TextEntity name = new TextEntity();
        name.setShortText("Rope");
        when(storyReadPort.findTextByStoryIdTextAndLang(5L, 99, "en")).thenReturn(Optional.of(name));

        GamingCharacterInstanceEntity c = character();
        c.setId(10L);
        c.setIdUser(7L);
        c.setIdLocation(6L);
        GamingCharacterTraitsEntity known = new GamingCharacterTraitsEntity();
        known.setIdTraits(4L);
        GamingCharacterTraitsEntity dangling = new GamingCharacterTraitsEntity();
        dangling.setIdTraits(999L);
        when(characterReadPort.findBackpack(1L, 10L)).thenReturn(Optional.empty());
        when(characterReadPort.findTraits(1L, 10L)).thenReturn(List.of(known, dangling));
        when(characterReadPort.findInventory(1L, 10L)).thenReturn(List.of(
                inventoryRow("inv-1", 8L, 2),      // resolves to the story item
                inventoryRow("inv-2", 777L, 1),    // dangling id_item
                inventoryRow("inv-3", null, 1)));  // no id_item at all

        CharacterInstanceInfo info = CharacterMapper.buildAll(List.of(c), match(5L),
                storyReadPort, characterReadPort, "user-uuid", 7L).get(0);

        assertEquals("user-uuid", info.getUserUuid());
        assertEquals(List.of("trait-uuid"), info.getTraitUuids());
        assertEquals(3, info.getItems().size());
        assertEquals("item-uuid", info.getItems().get(0).getItemUuid());
        assertEquals("Rope", info.getItems().get(0).getName());
        assertEquals(2, info.getItems().get(0).getWeight());
        assertEquals(0, info.getItems().get(1).getWeight());
        assertNull(info.getItems().get(2).getItemUuid());
        assertEquals(4, info.getWeight()); // only the resolved item weighs: 2 × 2
    }

    // === Step 34: inventory masking, item cards and the language ===

    /** Two characters in one match: id 10 belongs to the requester (user 7), id 11 does not. */
    private static GamingCharacterInstanceEntity party(long id, long idUser) {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setUuid("char-" + id);
        c.setId(id);
        c.setIdUser(idUser);
        return c;
    }

    private static ItemEntity storyItem() {
        ItemEntity item = new ItemEntity();
        item.setId(8L);
        item.setUuid("item-uuid");
        item.setWeight(2);
        item.setIdCard(77);
        item.setIsConsumabile(1);
        item.setIdTextName(99);
        return item;
    }

    private static CardInfo aCard() {
        return new CardInfo("card-77", null, null, null, "fas fa-box", null, null,
                null, null, null, null, null, null, null, null);
    }

    private static CharacterReadPort partyReadPort() {
        CharacterReadPort port = mock(CharacterReadPort.class);
        when(port.findBackpack(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(port.findTraits(anyLong(), anyLong())).thenReturn(List.of());
        when(port.findInventory(anyLong(), anyLong()))
                .thenReturn(List.of(inventoryRow("inv-1", 8L, 2)));
        return port;
    }

    private static StoryReadPort partyStoryPort() {
        StoryReadPort port = mock(StoryReadPort.class);
        when(port.findCharacterTemplatesByStoryId(5L)).thenReturn(List.of());
        when(port.findTraitsByStoryId(5L)).thenReturn(List.of());
        when(port.findLocationsByStoryId(5L)).thenReturn(List.of());
        when(port.findItemsByStoryId(5L)).thenReturn(List.of(storyItem()));
        return port;
    }

    @Test
    @DisplayName("masked: the items key stays on every player, populated only for the requester")
    void inventoryIsMaskedForTheOtherPlayers() {
        StoryReadPort storyReadPort = partyStoryPort();
        CharacterReadPort characterReadPort = partyReadPort();

        List<CharacterInstanceInfo> players = CharacterMapper.buildAll(
                List.of(party(10L, 7L), party(11L, 8L)), match(5L),
                new CharacterMapper.MapperContext(storyReadPort, characterReadPort, null,
                        "user-uuid", 7L, "en", true));

        assertEquals(1, players.get(0).getItems().size(), "the requester sees their own items");
        assertNotNull(players.get(1).getItems(), "the key is present, never null");
        assertEquals(0, players.get(1).getItems().size(), "and empty for everybody else");
        // The masked branch does not even query the other player's inventory.
        verify(characterReadPort).findInventory(1L, 10L);
        verify(characterReadPort, never()).findInventory(1L, 11L);
    }

    @Test
    @DisplayName("the admin view is exempt: it has no requester, so masking would blank everyone")
    void adminViewIsNotMasked() {
        List<CharacterInstanceInfo> players = CharacterMapper.buildAll(
                List.of(party(10L, 7L), party(11L, 8L)), match(5L),
                new CharacterMapper.MapperContext(partyStoryPort(), partyReadPort(), null,
                        null, null, "en", false));

        assertEquals(1, players.get(0).getItems().size());
        assertEquals(1, players.get(1).getItems().size());
    }

    @Test
    @DisplayName("the item card is resolved when a content port is wired, in the requested language")
    void resolvesItemCardsInTheRequestedLanguage() {
        StoryReadPort storyReadPort = partyStoryPort();
        ContentQueryPort contentQueryPort = mock(ContentQueryPort.class);
        when(contentQueryPort.getCardByStoryIdAndCardId(5L, 77, "it")).thenReturn(aCard());
        TextEntity name = new TextEntity();
        name.setShortText("Corda");
        when(storyReadPort.findTextByStoryIdTextAndLang(5L, 99, "it")).thenReturn(Optional.of(name));

        CharacterInstanceInfo info = CharacterMapper.buildAll(
                List.of(party(10L, 7L)), match(5L),
                new CharacterMapper.MapperContext(storyReadPort, partyReadPort(), contentQueryPort,
                        "user-uuid", 7L, "it", true)).get(0);

        ItemInstanceInfo item = info.getItems().get(0);
        assertEquals(77, item.getIdCard());
        assertEquals("card-77", item.getCard().uuid());
        assertEquals("Corda", item.getName());
        assertEquals(Boolean.TRUE, item.getIsConsumabile());
    }

    @Test
    @DisplayName("Step 35 — the /info items promise the same effects the inventory endpoint does")
    void itemsCarryTheEffectPromise() {
        StoryReadPort storyReadPort = partyStoryPort();
        ItemEffectEntity heal = new ItemEffectEntity();
        heal.setId(1L);
        heal.setIdItem(8);
        heal.setEffectCode("LIFE");
        heal.setEffectValue(3);
        when(storyReadPort.findItemEffectsByStoryId(5L)).thenReturn(List.of(heal));

        List<CharacterInstanceInfo> players = CharacterMapper.buildAll(
                List.of(party(10L, 7L), party(11L, 8L)), match(5L),
                new CharacterMapper.MapperContext(storyReadPort, partyReadPort(), null,
                        "user-uuid", 7L, "en", true));

        ItemInstanceInfo item = players.get(0).getItems().get(0);
        assertEquals(1, item.getEffects().size());
        assertEquals("life", item.getEffects().get(0).getStatistic());
        assertEquals(3, item.getEffects().get(0).getValue());
        // One query for the whole story, however many characters are standing in the match.
        verify(storyReadPort).findItemEffectsByStoryId(5L);
    }

    @Test
    @DisplayName("the legacy 6-arg entry point keeps its pre-Step-34 behaviour: English, no masking")
    void legacyOverloadIsUnchanged() {
        StoryReadPort storyReadPort = partyStoryPort();

        List<CharacterInstanceInfo> players = CharacterMapper.buildAll(
                List.of(party(10L, 7L), party(11L, 8L)), match(5L),
                storyReadPort, partyReadPort(), "user-uuid", 7L);

        assertEquals(1, players.get(0).getItems().size());
        assertEquals(1, players.get(1).getItems().size(), "the legacy path never masked");
        assertNull(players.get(0).getItems().get(0).getCard(), "and resolved no cards");
        verify(storyReadPort, times(2)).findTextByStoryIdTextAndLang(5L, 99, "en");
    }
}
