package games.paths.core.service;

import games.paths.core.port.EchoPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link EchoService}.
 * Verifies server status reporting, timestamp accuracy, and property management.
 */
@ExtendWith(MockitoExtension.class)
class EchoServiceTest {

    private EchoPort echoPort;
    private static final String DEFAULT_STATUS = "OK";
    private static final Map<String, String> DEFAULT_PROPS = Map.of(
            "env", "test",
            "version", "1.0.0-TEST",
            "applicationName", "paths-game-test"
    );

    @BeforeEach
    void setUp() {
        // Inizializzazione del servizio con proprietà standard di test
        echoPort = new EchoService(DEFAULT_STATUS, DEFAULT_PROPS);
    }

    // --- SEZIONE: STATO DEL SERVER ---

    @Nested
    @DisplayName("Server Status Tests")
    class StatusTests {

        @Test
        @DisplayName("Should return the status configured during initialization")
        void getServerStatus_returnsConfiguredStatus() {
            assertEquals(DEFAULT_STATUS, echoPort.getServerStatus());
        }

        @Test
        @DisplayName("Should return custom status when initialized with different values")
        void getServerStatus_returnsCustomStatus() {
            EchoPort maintenanceService = new EchoService("MAINTENANCE", Map.of());
            assertEquals("MAINTENANCE", maintenanceService.getServerStatus());
        }
    }

    // --- SEZIONE: GESTIONE PROPRIETÀ ---

    @Nested
    @DisplayName("Server Properties Tests")
    class PropertiesTests {

        @Test
        @DisplayName("Should provide access to all configured server properties")
        void getServerProperties_returnsAllProperties() {
            Map<String, String> props = echoPort.getServerProperties();
            
            assertAll("Property mapping validation",
                () -> assertEquals("test", props.get("env")),
                () -> assertEquals("1.0.0-TEST", props.get("version")),
                () -> assertEquals("paths-game-test", props.get("applicationName")),
                () -> assertEquals(3, props.size())
            );
        }

        @Test
        @DisplayName("Should return an unmodifiable map to protect internal state")
        void getServerProperties_isImmutable() {
            Map<String, String> props = echoPort.getServerProperties();
            // Verifica che il tentativo di modifica lanci l'eccezione corretta
            assertThrows(UnsupportedOperationException.class, () -> props.put("unauthorized", "write"));
        }

        @Test
        @DisplayName("Should handle cases with no properties configured")
        void getServerProperties_handlesEmptyMap() {
            EchoPort minimalService = new EchoService(DEFAULT_STATUS, Map.of());
            assertNotNull(minimalService.getServerProperties());
            assertTrue(minimalService.getServerProperties().isEmpty());
        }
    }

    // --- SEZIONE: TIMESTAMP E DIAGNOSTICA ---

    @Nested
    @DisplayName("Diagnostics Tests")
    class DiagnosticTests {

        @Test
        @DisplayName("Should return a timestamp within the execution time window")
        void getTimestamp_isApproximatelyCurrent() {
            // Branch: Verifica che il timestamp generato sia coerente con il clock di sistema
            long before = System.currentTimeMillis();
            long timestamp = echoPort.getTimestamp();
            long after = System.currentTimeMillis();

            assertTrue(timestamp >= before && timestamp <= after, 
                "Timestamp should be between " + before + " and " + after);
        }
    }
}