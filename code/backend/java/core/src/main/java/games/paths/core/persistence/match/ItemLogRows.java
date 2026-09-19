package games.paths.core.persistence.match;

import games.paths.core.entity.match.LogItemUsageEntity;
import games.paths.core.port.match.EventExecutionStorePort.ResourceDelta;
import games.paths.core.repository.match.LogItemUsageRepository;
import games.paths.core.model.match.LogTable;
import games.paths.core.port.match.LogIdPort;

/**
 * ItemLogRows - builds and saves a {@code log_item_usage} row (v0.35.4).
 * Shared by the two adapters that write one, so the id allocation lives once.
 */
final class ItemLogRows {

    private ItemLogRows() {
    }

    /** The id is table-wide ({@code UNIQUE (id)}), so it comes from {@link LogIdPort}. */
    static void append(LogItemUsageRepository repository, LogIdPort logIds, long idMatch, long idCharacter,
                       long idItem, String action, int counter, Long idEvent,
                       String effectsJson, ResourceDelta delta) {
        ResourceDelta d = delta == null ? ResourceDelta.none() : delta;
        LogItemUsageEntity row = new LogItemUsageEntity();
        row.setId(logIds.nextId(LogTable.ITEM_USAGE));
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
