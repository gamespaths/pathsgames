package games.paths.core.service.event;

import games.paths.core.port.event.DomainEventPublisher;

/**
 * InProcessDomainEventPublisher - default {@link DomainEventPublisher}.
 *
 * <p>Step 25: logs the event and is a no-op transport. It exists so the domain
 * can publish events today and later steps can replace/extend the transport
 * (WebSocket in Step 64) without touching the domain services.</p>
 */
public class InProcessDomainEventPublisher implements DomainEventPublisher {

    private static final System.Logger LOGGER =
            System.getLogger(InProcessDomainEventPublisher.class.getName());

    @Override
    public void publish(Object event) {
        if (event == null) return;
        LOGGER.log(System.Logger.Level.DEBUG, "Domain event published: {0}", event);
    }
}
