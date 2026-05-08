-- Align Postgres type with JPA entity mapping used by match runtime state.
-- SQLite already stores this field as INTEGER (0/1).
ALTER TABLE gaming_state_locations
    ALTER COLUMN flag_already_actived DROP DEFAULT;

ALTER TABLE gaming_state_locations
    ALTER COLUMN flag_already_actived TYPE INTEGER
    USING (CASE WHEN flag_already_actived THEN 1 ELSE 0 END);

ALTER TABLE gaming_state_locations
    ALTER COLUMN flag_already_actived SET DEFAULT 0;