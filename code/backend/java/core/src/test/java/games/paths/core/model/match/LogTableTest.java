package games.paths.core.model.match;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** LogTable (v0.38.1) — table and BIGSERIAL sequence names of the log_* tables. */
@DisplayName("LogTable (v0.38.1)")
class LogTableTest {

    @ParameterizedTest
    @EnumSource(LogTable.class)
    void sequenceFollowsTheTableName(LogTable table) {
        assertAll(
                () -> assertTrue(table.tableName().startsWith("log_"), table.name()),
                () -> assertEquals(table.tableName() + "_id_seq", table.sequenceName()));
    }
}
