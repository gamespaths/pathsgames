-- paths.games MySQL Database Schema

CREATE DATABASE IF NOT EXISTS pathsgames CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pathsgames;

-- gaming_user_sessions Table (Guest Sessions)
-- Matches the Python SQLite schema columns
CREATE TABLE IF NOT EXISTS gaming_user_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL,
    nickname VARCHAR(100) DEFAULT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'PLAYER',
    state INT NOT NULL DEFAULT 6,
    guest_cookie_token VARCHAR(255) NOT NULL UNIQUE,
    guest_expires_at DATETIME DEFAULT NULL,
    language VARCHAR(10) DEFAULT NULL,
    ts_insert DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ts_update DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ts_registration DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ts_last_access DATETIME DEFAULT NULL,
    expires_at DATETIME NOT NULL,
    INDEX idx_guest_cookie (guest_cookie_token),
    INDEX idx_expires_at (expires_at),
    INDEX idx_uuid (uuid)
) ENGINE=InnoDB;

-- users_tokens Table (Refresh Tokens)
CREATE TABLE IF NOT EXISTS users_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_user BIGINT NOT NULL,
    token TEXT NOT NULL,
    jti VARCHAR(255) DEFAULT NULL,
    revoked TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    ts_insert DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_token (id_user),
    INDEX idx_token_jti (jti),
    FOREIGN KEY (id_user) REFERENCES gaming_user_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Step 14: Story Import Schema

CREATE TABLE IF NOT EXISTS list_stories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    author VARCHAR(255) DEFAULT NULL,
    category VARCHAR(100) DEFAULT NULL,
    group_name VARCHAR(100) DEFAULT NULL,
    visibility VARCHAR(20) DEFAULT 'DRAFT',
    priority INT DEFAULT 0,
    peghi INT DEFAULT 0,
    version_min VARCHAR(20) DEFAULT NULL,
    version_max VARCHAR(20) DEFAULT NULL,
    clock_singular VARCHAR(100) DEFAULT NULL,
    clock_plural VARCHAR(100) DEFAULT NULL,
    link_copyright VARCHAR(500) DEFAULT NULL,
    id_story BIGINT DEFAULT NULL,
    id_card BIGINT DEFAULT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_title BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    id_text_copyright BIGINT DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_stories_difficulty (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    uuid VARCHAR(36) DEFAULT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    exp_cost INT DEFAULT NULL,
    max_weight INT DEFAULT NULL,
    min_character INT DEFAULT NULL,
    max_character INT DEFAULT NULL,
    cost_help_coma INT DEFAULT NULL,
    cost_max_characteristics INT DEFAULT NULL,
    number_max_free_action INT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_texts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_text BIGINT NOT NULL,
    id_card BIGINT DEFAULT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    id_text_copyright BIGINT DEFAULT NULL,
    link_copyright VARCHAR(500) DEFAULT NULL,
    id_creator BIGINT DEFAULT NULL,
    lang VARCHAR(10) DEFAULT 'en',
    short_text TEXT DEFAULT NULL,
    long_text TEXT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_locations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    is_safe INT DEFAULT 0,
    max_characters INT DEFAULT NULL,
    id_event_on_enter BIGINT DEFAULT NULL,
    id_event_if_counter_zero BIGINT DEFAULT NULL,
    counter_start INT DEFAULT NULL,
    id_card BIGINT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_locations_neighbors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    id_card BIGINT DEFAULT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    id_location_from BIGINT DEFAULT NULL,
    id_location_to BIGINT DEFAULT NULL,
    direction VARCHAR(20) DEFAULT NULL,
    energy_cost INT DEFAULT 1,
    condition_key VARCHAR(255) DEFAULT NULL,
    condition_value VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    event_type VARCHAR(50) DEFAULT NULL,
    trigger_type VARCHAR(50) DEFAULT NULL,
    energy_cost INT DEFAULT 0,
    coin_cost INT DEFAULT 0,
    id_event_next BIGINT DEFAULT NULL,
    flag_interrupt INT DEFAULT 0,
    flag_end_time INT DEFAULT 0,
    id_location BIGINT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_events_effects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    id_event BIGINT DEFAULT NULL,
    effect_type VARCHAR(50) DEFAULT NULL,
    effect_value INT DEFAULT NULL,
    flag_group INT DEFAULT 0,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    weight INT DEFAULT 0,
    id_class BIGINT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_items_effects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    id_card BIGINT DEFAULT NULL,
    id_item BIGINT DEFAULT NULL,
    effect_type VARCHAR(50) DEFAULT NULL,
    effect_value INT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_classes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    weight_max INT DEFAULT 10,
    dexterity_base INT DEFAULT 1,
    intelligence_base INT DEFAULT 1,
    constitution_base INT DEFAULT 1,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_classes_bonus (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    id_class BIGINT DEFAULT NULL,
    bonus_type VARCHAR(50) DEFAULT NULL,
    bonus_value INT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_choices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_event BIGINT DEFAULT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    priority INT DEFAULT 0,
    is_otherwise INT DEFAULT 0,
    is_progress INT DEFAULT 0,
    id_event_torun BIGINT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_choices_conditions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    id_card BIGINT DEFAULT NULL,
    id_choice BIGINT DEFAULT NULL,
    condition_type VARCHAR(50) DEFAULT NULL,
    condition_key VARCHAR(255) DEFAULT NULL,
    condition_value VARCHAR(255) DEFAULT NULL,
    condition_operator VARCHAR(10) DEFAULT 'AND',
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_choices_effects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    id_card BIGINT DEFAULT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    id_choice BIGINT DEFAULT NULL,
    effect_type VARCHAR(50) DEFAULT NULL,
    effect_value INT DEFAULT NULL,
    flag_group INT DEFAULT 0,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_cards (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_card BIGINT DEFAULT NULL,
    card_type VARCHAR(50) DEFAULT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_title BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    id_text_copyright BIGINT DEFAULT NULL,
    link_copyright VARCHAR(500) DEFAULT NULL,
    id_creator BIGINT DEFAULT NULL,
    image_url VARCHAR(500) DEFAULT NULL,
    alternative_image TEXT DEFAULT NULL,
    awesome_icon VARCHAR(100) DEFAULT NULL,
    style_main VARCHAR(100) DEFAULT NULL,
    style_detail VARCHAR(100) DEFAULT NULL,
    id_reference BIGINT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    key_name VARCHAR(255) DEFAULT NULL,
    key_value VARCHAR(255) DEFAULT NULL,
    key_group VARCHAR(100) DEFAULT NULL,
    is_visible INT DEFAULT 0,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_traits (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    cost_positive INT DEFAULT 0,
    cost_negative INT DEFAULT 0,
    id_class_permitted BIGINT DEFAULT NULL,
    id_class_prohibited BIGINT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_character_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_tipo BIGINT DEFAULT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    life_max INT DEFAULT 10,
    energy_max INT DEFAULT 10,
    sad_max INT DEFAULT 10,
    dexterity_start INT DEFAULT 1,
    intelligence_start INT DEFAULT 1,
    constitution_start INT DEFAULT 1,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_weather_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    probability FLOAT DEFAULT NULL,
    delta_energy INT DEFAULT 0,
    id_event BIGINT DEFAULT NULL,
    condition_key VARCHAR(255) DEFAULT NULL,
    condition_value VARCHAR(255) DEFAULT NULL,
    time_start INT DEFAULT NULL,
    time_end INT DEFAULT NULL,
    is_active INT DEFAULT 1,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_global_random_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    id_event BIGINT DEFAULT NULL,
    probability FLOAT DEFAULT NULL,
    condition_key VARCHAR(255) DEFAULT NULL,
    condition_value VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_missions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT NULL,
    id_story BIGINT NOT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    condition_key VARCHAR(255) DEFAULT NULL,
    condition_value_from VARCHAR(255) DEFAULT NULL,
    condition_value_to VARCHAR(255) DEFAULT NULL,
    id_event_completed BIGINT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_missions_steps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    id_mission BIGINT DEFAULT NULL,
    step_order INT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    condition_key VARCHAR(255) DEFAULT NULL,
    condition_value VARCHAR(255) DEFAULT NULL,
    id_event_completed BIGINT DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_creator (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_story BIGINT NOT NULL,
    uuid VARCHAR(36) DEFAULT NULL,
    id_card BIGINT DEFAULT NULL,
    id_text BIGINT DEFAULT NULL,
    id_text_name BIGINT DEFAULT NULL,
    id_text_description BIGINT DEFAULT NULL,
    creator_name VARCHAR(255) DEFAULT NULL,
    creator_role VARCHAR(100) DEFAULT NULL,
    link VARCHAR(500) DEFAULT NULL,
    url VARCHAR(500) DEFAULT NULL,
    url_image VARCHAR(500) DEFAULT NULL,
    url_emote VARCHAR(500) DEFAULT NULL,
    url_instagram VARCHAR(500) DEFAULT NULL,
    FOREIGN KEY (id_story) REFERENCES list_stories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

