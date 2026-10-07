-- v0.38.1: the log_* ids now come from the BIGSERIAL sequences (LogIdAdapter) instead of
-- MAX(id) + 1 computed per request; move each sequence past the rows already written.
SELECT setval('log_events_id_seq',           COALESCE((SELECT MAX(id) FROM log_events), 0) + 1,           false);
SELECT setval('log_movements_id_seq',        COALESCE((SELECT MAX(id) FROM log_movements), 0) + 1,        false);
SELECT setval('log_item_usage_id_seq',       COALESCE((SELECT MAX(id) FROM log_item_usage), 0) + 1,       false);
SELECT setval('log_weather_id_seq',          COALESCE((SELECT MAX(id) FROM log_weather), 0) + 1,          false);
SELECT setval('log_clock_history_id_seq',    COALESCE((SELECT MAX(id) FROM log_clock_history), 0) + 1,    false);
SELECT setval('log_choices_executed_id_seq', COALESCE((SELECT MAX(id) FROM log_choices_executed), 0) + 1, false);
