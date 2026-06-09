package games.paths.core.service.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.port.match.CharacterReadPort;
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
     * Builds the full list of character infos for a match. The {@code requesterUserUuid}
     * / {@code requesterUserId} pair is echoed onto the character owned by the
     * requesting user (the per-instance class/user uuid is not otherwise
     * persisted in V0).
     */
    static List<CharacterInstanceInfo> buildAll(List<GamingCharacterInstanceEntity> characters,
                                                GamingMatchEntity match,
                                                StoryReadPort storyReadPort,
                                                CharacterReadPort characterReadPort,
                                                String requesterUserUuid,
                                                Long requesterUserId) {
        if (characters == null || characters.isEmpty()) {
            return new ArrayList<>();
        }
        Long storyId = match.getIdStory();
        Map<Long, String> templateUuidById = new HashMap<>();
        Map<Long, String> traitUuidById = new HashMap<>();
        Map<Long, LocationEntity> locationById = new HashMap<>();
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
            LocationEntity location = c.getIdLocation() != null ? locationById.get(c.getIdLocation()) : null;
            String userUuid = (requesterUserId != null && requesterUserId.equals(c.getIdUser()))
                    ? requesterUserUuid : null;
            result.add(build(c, match.getUuid(), userUuid, templateUuidById, backpack, traitUuids, location));
        }
        return result;
    }

    static CharacterInstanceInfo build(GamingCharacterInstanceEntity c,
                                       String matchUuid,
                                       String userUuid,
                                       Map<Long, String> templateUuidById,
                                       GamingBackpackResourcesEntity backpack,
                                       List<String> traitUuids,
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
        info.setIdLocation(c.getIdLocation());
        info.setIsSleeping(c.getIsSleeping());
        info.setIsComa(c.getIsComa());
        info.setTraitUuids(traitUuids != null ? new ArrayList<>(traitUuids) : new ArrayList<>());
        if (backpack != null) {
            info.setFood(backpack.getFood());
            info.setMagic(backpack.getMagic());
            info.setCoin(backpack.getCoin());
        }
        if (location != null) {
            info.setLocationUuid(location.getUuid());
            info.setLocationName("location-" + location.getId());
        }
        return info;
    }
}
