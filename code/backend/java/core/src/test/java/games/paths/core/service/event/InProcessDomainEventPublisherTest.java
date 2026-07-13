package games.paths.core.service.event;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

class InProcessDomainEventPublisherTest {

    private final InProcessDomainEventPublisher publisher = new InProcessDomainEventPublisher();

    @Test
    void publish_null_doesNotThrow() {
        assertDoesNotThrow(() -> publisher.publish(null));
    }

    @Test
    void publish_event_doesNotThrow() {
        assertDoesNotThrow(() -> publisher.publish("domain-event"));
    }

    @Test
    void publish_objectEvent_doesNotThrow() {
        assertDoesNotThrow(() -> publisher.publish(new Object()));
    }
}
