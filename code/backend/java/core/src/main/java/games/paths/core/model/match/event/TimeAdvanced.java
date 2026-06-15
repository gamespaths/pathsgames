package games.paths.core.model.match.event;

/**
 * TimeAdvanced - domain event emitted when a match's clock advances to a new
 * time unit (Step 25). Carries the match uuid and the new clock value.
 *
 * <p>WebSocket broadcasting of this event is deferred to Step 64; for now it is
 * published in-process via {@code DomainEventPublisher}.</p>
 */
public record TimeAdvanced(String matchUuid, int newClock) {
}
