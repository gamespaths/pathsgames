package games.paths.core.service.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * CharacterMapper - mapping helper shared by {@link CharacterQueryService} and
 * {@code MatchQueryService.buildDetail}. Resolves the per-match characters into
 * {@link CharacterInstanceInfo} models (template uuid, trait uuids, backpack and
 * location). Step 21.
 */
final class CharacterMapper {

    private CharacterMapper() {
    }

    /**
     * Collaborators and per-request options of {@link #buildAll}. A parameter
     * object rather than a nine-argument signature.
     *
     * @param contentQueryPort      may be null — item cards are then left unresolved
     * @param lang                  null or blank falls back to English
     * @param maskOtherInventories  Step 34 — when true, {@code items[]} stays present on
     *                              every player but is populated only for the requester.
     *                              Admin views pass false: {@code getMatchInfoForAdmin}
     *                              has no requester at all, and masking there would blank
     *                              the whole console.
     */
    record MapperContext(StoryReadPort storyReadPort,
                         CharacterReadPort characterReadPort,
                         ContentQueryPort contentQueryPort,
                         String requesterUserUuid,
                         Long requesterUserId,
                         String lang,
                         boolean maskOtherInventories) {
    }

    /**
     * Legacy entry point: English texts, no item cards, no inventory masking.
     * Kept so pre-Step-34 callers keep compiling unchanged.
     */
    static List<CharacterInstanceInfo> buildAll(List<GamingCharacterInstanceEntity> characters,
                                                GamingMatchEntity match,
                                                StoryReadPort storyReadPort,
                                                CharacterReadPort characterReadPort,
                                                String requesterUserUuid,
                                                Long requesterUserId) {
        return buildAll(characters, match, new MapperContext(
                storyReadPort, characterReadPort, null,
                requesterUserUuid, requesterUserId, ItemInstanceMapper.DEFAULT_LANG, false));
    }

    /**
     * Builds the full list of character infos for a match. The {@code requesterUserUuid}
     * / {@code requesterUserId} pair is echoed onto the character owned by the
     * requesting user (the per-instance class/user uuid is not otherwise
     * persisted in V0).
     */
    static List<CharacterInstanceInfo> buildAll(List<GamingCharacterInstanceEntity> characters,
                                                GamingMatchEntity match,
                                                MapperContext ctx) {
        if (characters == null || characters.isEmpty()) {
            return new ArrayList<>();
        }
        StoryReadPort storyReadPort = ctx.storyReadPort();
        CharacterReadPort characterReadPort = ctx.characterReadPort();
        String requesterUserUuid = ctx.requesterUserUuid();
        Long requesterUserId = ctx.requesterUserId();
        Map<Integer, CardInfo> cardCache = new HashMap<>();
        Long storyId = match.getIdStory();
        Map<Long, String> templateUuidById = new HashMap<>();
        Map<Long, String> traitUuidById = new HashMap<>();
        Map<Long, LocationEntity> locationById = new HashMap<>();
        Map<Long, ItemEntity> itemById = new HashMap<>();
        if (storyId != null) {
            for (CharacterTemplateEntity t : storyReadPort.findCharacterTemplatesByStoryId(storyId)) {
                templateUuidById.put(t.getIdTipo(), t.getUuid());
            }
            for (TraitEntity t : storyReadPort.findTraitsByStoryId(storyId)) {
                traitUuidById.put(t.getId(), t.getUuid());
            }
            for (LocationEntity l : storyReadPort.findLocationsByStoryId(storyId)) {
                locationById.put(l.getId(), l);
            }
            for (ItemEntity i : storyReadPort.findItemsByStoryId(storyId)) {
                itemById.put(i.getId(), i);
            }
        }

        List<CharacterInstanceInfo> result = new ArrayList<>();
        for (GamingCharacterInstanceEntity c : characters) {
            GamingBackpackResourcesEntity backpack =
                    characterReadPort.findBackpack(match.getId(), c.getId()).orElse(null);
            List<String> traitUuids = new ArrayList<>();
            for (GamingCharacterTraitsEntity row : characterReadPort.findTraits(match.getId(), c.getId())) {
                String uuid = traitUuidById.get(row.getIdTraits());
                if (uuid != null) {
                    traitUuids.add(uuid);
                }
            }
            boolean isRequester = requesterUserId != null && requesterUserId.equals(c.getIdUser());
            // Step 34 — the key stays on every player, the array is only filled for the
            // caller. The masked branch also skips the findInventory query entirely.
            List<ItemInstanceInfo> items = (ctx.maskOtherInventories() && !isRequester)
                    ? new ArrayList<>()
                    : ItemInstanceMapper.build(
                            characterReadPort.findInventory(match.getId(), c.getId()),
                            itemById, storyReadPort, ctx.contentQueryPort(), storyId, ctx.lang(), cardCache);
            LocationEntity location = c.getIdLocation() != null ? locationById.get(c.getIdLocation()) : null;
            String userUuid = isRequester ? requesterUserUuid : null;
            result.add(build(c, match.getUuid(), userUuid, templateUuidById, backpack, traitUuids, items, location));
        }
        return result;
    }

    /** Total carried weight = Σ (item.weight × amount) over the resolved items. */
    private static int totalWeight(List<ItemInstanceInfo> items) {
        return ItemInstanceMapper.totalWeight(items);
    }

    static CharacterInstanceInfo build(GamingCharacterInstanceEntity c,
                                       String matchUuid,
                                       String userUuid,
                                       Map<Long, String> templateUuidById,
                                       GamingBackpackResourcesEntity backpack,
                                       List<String> traitUuids,
                                       List<ItemInstanceInfo> items,
                                       LocationEntity location) {
        CharacterInstanceInfo info = new CharacterInstanceInfo();
        info.setUuid(c.getUuid());
        info.setMatchUuid(matchUuid);
        info.setUserUuid(userUuid);
        info.setCharacterTemplateUuid(
                c.getIdCharacterTemplate() != null ? templateUuidById.get(c.getIdCharacterTemplate()) : null);
        info.setDexterity(c.getDexterity());
        info.setIntelligence(c.getIntelligence());
        info.setConstitution(c.getConstitution());
        info.setEnergy(c.getEnergy());
        info.setLife(c.getLife());
        info.setSad(c.getSad());
        info.setLifeMax(c.getLifeMax());
        info.setEnergyMax(c.getEnergyMax());
        info.setSadMax(c.getSadMax());
        info.setWeightMax(c.getWeightMax());
        List<ItemInstanceInfo> resolvedItems = items != null ? items : new ArrayList<>();
        info.setItems(resolvedItems);
        // pass the raw list: totalWeight owns the null case (a null list weighs 0)
        info.setWeight(totalWeight(items));
        info.setIdLocation(c.getIdLocation());
        info.setIsSleeping(c.getIsSleeping());
        info.setIsComa(c.getIsComa());
        info.setClockInComa(c.getClockInComa());
        info.setTraitUuids(traitUuids != null ? new ArrayList<>(traitUuids) : new ArrayList<>());
        if (backpack != null) {
            info.setFood(backpack.getFood());
            info.setMagic(backpack.getMagic());
            info.setCoin(backpack.getCoin());
        }
        if (location != null) {
            info.setLocationUuid(location.getUuid());
        }
        return info;
    }
}
