package games.paths.core.persistence.match;

import games.paths.core.entity.match.LogItemUsageEntity;
import games.paths.core.port.match.EventExecutionStorePort.ResourceDelta;
import games.paths.core.repository.match.LogItemUsageRepository;

/**
 * ItemLogRows - builds and saves a {@code log_item_usage} row (v0.35.4).
 * Shared by the two adapters that write one, so the id allocation lives once.
 */
final class ItemLogRows {

    private ItemLogRows() {
    }

    /**
     * The id comes from the table-wide maximum: {@code log_item_usage} carries
     * {@code UNIQUE (id)}, unlike the per-match {@code gaming_*} tables.
     */
    static void append(LogItemUsageRepository repository, long idMatch, long idCharacter,
                       long idItem, String action, int counter, Long idEvent,
                       String effectsJson, ResourceDelta delta) {
        ResourceDelta d = delta == null ? ResourceDelta.none() : delta;
        LogItemUsageEntity row = new LogItemUsageEntity();
        row.setId(repository.findMaxId() + 1L);
        row.setIdMatch(idMatch);
        row.setIdCharacterMatch(idCharacter);
        row.setIdItem(idItem);
        row.setAction(action);
        row.setCounter(counter);
        row.setIdEvent(idEvent);
        row.setEffectsJson(effectsJson);
        row.setEnergy(d.energy());
        row.setFood(d.food());
        row.setMagic(d.magic());
        row.setCoin(d.coin());
        repository.save(row);
    }
}
