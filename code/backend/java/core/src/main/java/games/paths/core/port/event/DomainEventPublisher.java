package games.paths.core.port.event;

/**
 * DomainEventPublisher - outbound port for publishing in-process domain events.
 *
 * <p>Step 25 introduces this seam so later steps (e.g. the WebSocket broadcast in
 * Step 64) can subscribe to events such as {@code TimeAdvanced} instead of being
 * retrofitted. The current implementation is in-process only; no transport.</p>
 */
public interface DomainEventPublisher {

    /** Publish a domain event to any in-process subscribers. */
    void publish(Object event);
}
