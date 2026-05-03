<?php

declare(strict_types=1);

namespace Games\Paths\Adapter\Persistence\Story;

use Games\Paths\Core\Port\Story\StoryPersistencePort;
use PDO;

class StoryMysqlPersistenceRepository implements StoryPersistencePort
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function findStoryIdByUuid(string $uuid): ?int
    {
        $stmt = $this->pdo->prepare("SELECT id FROM list_stories WHERE uuid = :uuid LIMIT 1");
        $stmt->execute([':uuid' => $uuid]);
        $id = $stmt->fetchColumn();
        return $id === false ? null : (int)$id;
    }

    public function deleteStoryById(int $storyId): void
    {
        // Because we set up the tables with ON DELETE CASCADE in the schema,
        // deleting the story will auto-delete all related records.
        $stmt = $this->pdo->prepare("DELETE FROM list_stories WHERE id = :id");
        $stmt->execute([':id' => $storyId]);
    }

    public function saveStory(array $data): int
    {
        $explicitId = self::getLong($data, 'id', 'idStory', 'id_story');
        if ($explicitId !== null) {
            $stmt = $this->pdo->prepare("
                INSERT INTO list_stories (
                    id, uuid, author, category, group_name, visibility, priority, peghi, 
                    version_min, version_max, id_text_clock_singular, id_text_clock_plural, link_copyright,
                    id_text_title, id_text_description, id_text_copyright, id_card,
                    id_location_start, id_image, id_location_all_player_coma, id_event_all_player_coma,
                    id_event_end_game, id_creator
                ) VALUES (
                    :id, :uuid, :author, :category, :group_name, :visibility, :priority, :peghi,
                    :version_min, :version_max, :id_text_clock_singular, :id_text_clock_plural, :link_copyright,
                    :id_text_title, :id_text_description, :id_text_copyright, :id_card,
                    :id_location_start, :id_image, :id_location_all_player_coma, :id_event_all_player_coma,
                    :id_event_end_game, :id_creator
                )
            ");
            $stmt->execute([
                ':id' => $explicitId,
                ':uuid' => $data['uuid'],
                ':author' => $data['author'] ?? null,
                ':category' => $data['category'] ?? null,
                ':group_name' => $data['group'] ?? null,
                ':visibility' => $data['visibility'] ?? 'DRAFT',
                ':priority' => $data['priority'] ?? 0,
                ':peghi' => $data['peghi'] ?? 0,
                ':version_min' => $data['versionMin'] ?? null,
                ':version_max' => $data['versionMax'] ?? null,
                ':id_text_clock_singular' => $data['idTextClockSingular'] ?? null,
                ':id_text_clock_plural' => $data['idTextClockPlural'] ?? null,
                ':link_copyright' => $data['linkCopyright'] ?? null,
                ':id_text_title' => $data['idTextTitle'] ?? null,
                ':id_text_description' => $data['idTextDescription'] ?? null,
                ':id_text_copyright' => $data['idTextCopyright'] ?? null,
                ':id_card' => $data['idCard'] ?? null,
                ':id_location_start' => $data['idLocationStart'] ?? null,
                ':id_image' => $data['idImage'] ?? null,
                ':id_location_all_player_coma' => $data['idLocationAllPlayerComa'] ?? null,
                ':id_event_all_player_coma' => $data['idEventAllPlayerComa'] ?? null,
                ':id_event_end_game' => $data['idEventEndGame'] ?? null,
                ':id_creator' => $data['idCreator'] ?? null,
            ]);
            return $explicitId;
        }
        $stmt = $this->pdo->prepare("
            INSERT INTO list_stories (
                uuid, author, category, group_name, visibility, priority, peghi, 
                version_min, version_max, id_text_clock_singular, id_text_clock_plural, link_copyright,
                id_text_title, id_text_description, id_text_copyright, id_card,
                id_location_start, id_image, id_location_all_player_coma, id_event_all_player_coma,
                id_event_end_game, id_creator
            ) VALUES (
                :uuid, :author, :category, :group_name, :visibility, :priority, :peghi,
                :version_min, :version_max, :id_text_clock_singular, :id_text_clock_plural, :link_copyright,
                :id_text_title, :id_text_description, :id_text_copyright, :id_card,
                :id_location_start, :id_image, :id_location_all_player_coma, :id_event_all_player_coma,
                :id_event_end_game, :id_creator
            )
        ");
        $stmt->execute([
            ':uuid' => $data['uuid'],
            ':author' => $data['author'] ?? null,
            ':category' => $data['category'] ?? null,
            ':group_name' => $data['group'] ?? null,
            ':visibility' => $data['visibility'] ?? 'DRAFT',
            ':priority' => $data['priority'] ?? 0,
            ':peghi' => $data['peghi'] ?? 0,
            ':version_min' => $data['versionMin'] ?? null,
            ':version_max' => $data['versionMax'] ?? null,
            ':id_text_clock_singular' => $data['idTextClockSingular'] ?? null,
            ':id_text_clock_plural' => $data['idTextClockPlural'] ?? null,
            ':link_copyright' => $data['linkCopyright'] ?? null,
            ':id_text_title' => $data['idTextTitle'] ?? null,
            ':id_text_description' => $data['idTextDescription'] ?? null,
            ':id_text_copyright' => $data['idTextCopyright'] ?? null,
            ':id_card' => $data['idCard'] ?? null,
            ':id_location_start' => $data['idLocationStart'] ?? null,
            ':id_image' => $data['idImage'] ?? null,
            ':id_location_all_player_coma' => $data['idLocationAllPlayerComa'] ?? null,
            ':id_event_all_player_coma' => $data['idEventAllPlayerComa'] ?? null,
            ':id_event_end_game' => $data['idEventEndGame'] ?? null,
            ':id_creator' => $data['idCreator'] ?? null,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    public function saveTexts(int $storyId, array $texts): void
    {
        foreach ($texts as $t) {
            $explicitId = self::getLong($t, 'id');
            if ($explicitId !== null) {
                $stmt = $this->pdo->prepare("
                    INSERT INTO list_texts (
                        id, id_story, id_text, id_card, id_text_name, id_text_description, id_text_copyright,
                        link_copyright, id_creator, lang, short_text, long_text
                    ) VALUES (
                        :id, :id_story, :id_text, :id_card, :id_text_name, :id_text_description, :id_text_copyright,
                        :link_copyright, :id_creator, :lang, :short_text, :long_text
                    )
                ");
                $stmt->execute([
                    ':id' => $explicitId,
                    ':id_story' => $storyId,
                    ':id_text' => $t['idText'] ?? null,
                    ':id_card' => $t['idCard'] ?? null,
                    ':id_text_name' => $t['idTextName'] ?? null,
                    ':id_text_description' => $t['idTextDescription'] ?? null,
                    ':id_text_copyright' => $t['idTextCopyright'] ?? null,
                    ':link_copyright' => $t['linkCopyright'] ?? null,
                    ':id_creator' => $t['idCreator'] ?? null,
                    ':lang' => $t['lang'] ?? 'en',
                    ':short_text' => $t['shortText'] ?? null,
                    ':long_text' => $t['longText'] ?? null,
                ]);
            } else {
                $stmt = $this->pdo->prepare("
                    INSERT INTO list_texts (
                        id_story, id_text, id_card, id_text_name, id_text_description, id_text_copyright,
                        link_copyright, id_creator, lang, short_text, long_text
                    ) VALUES (
                        :id_story, :id_text, :id_card, :id_text_name, :id_text_description, :id_text_copyright,
                        :link_copyright, :id_creator, :lang, :short_text, :long_text
                    )
                ");
                $stmt->execute([
                    ':id_story' => $storyId,
                    ':id_text' => $t['idText'] ?? null,
                    ':id_card' => $t['idCard'] ?? null,
                    ':id_text_name' => $t['idTextName'] ?? null,
                    ':id_text_description' => $t['idTextDescription'] ?? null,
                    ':id_text_copyright' => $t['idTextCopyright'] ?? null,
                    ':link_copyright' => $t['linkCopyright'] ?? null,
                    ':id_creator' => $t['idCreator'] ?? null,
                    ':lang' => $t['lang'] ?? 'en',
                    ':short_text' => $t['shortText'] ?? null,
                    ':long_text' => $t['longText'] ?? null,
                ]);
            }
        }
    }

    public function saveDifficulties(int $storyId, array $difficulties): void
    {
        foreach ($difficulties as $d) {
            $explicitId = self::getLong($d, 'id');
            if ($explicitId !== null) {
                $stmt = $this->pdo->prepare("
                    INSERT INTO list_stories_difficulty (
                        id, id_story, uuid, id_text_description, exp_cost, max_weight,
                        min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action
                    ) VALUES (
                        :id, :id_story, :uuid, :id_text_description, :exp_cost, :max_weight,
                        :min_character, :max_character, :cost_help_coma, :cost_max_characteristics, :number_max_free_action
                    )
                ");
                $stmt->execute([
                    ':id' => $explicitId,
                    ':id_story' => $storyId,
                    ':uuid' => $d['uuid'] ?? null,
                    ':id_text_description' => $d['idTextDescription'] ?? null,
                    ':exp_cost' => $d['expCost'] ?? null,
                    ':max_weight' => $d['maxWeight'] ?? null,
                    ':min_character' => $d['minCharacter'] ?? null,
                    ':max_character' => $d['maxCharacter'] ?? null,
                    ':cost_help_coma' => $d['costHelpComa'] ?? null,
                    ':cost_max_characteristics' => $d['costMaxCharacteristics'] ?? null,
                    ':number_max_free_action' => $d['numberMaxFreeAction'] ?? null,
                ]);
            } else {
                $stmt = $this->pdo->prepare("
                    INSERT INTO list_stories_difficulty (
                        id_story, uuid, id_text_description, exp_cost, max_weight,
                        min_character, max_character, cost_help_coma, cost_max_characteristics, number_max_free_action
                    ) VALUES (
                        :id_story, :uuid, :id_text_description, :exp_cost, :max_weight,
                        :min_character, :max_character, :cost_help_coma, :cost_max_characteristics, :number_max_free_action
                    )
                ");
                $stmt->execute([
                    ':id_story' => $storyId,
                    ':uuid' => $d['uuid'] ?? null,
                    ':id_text_description' => $d['idTextDescription'] ?? null,
                    ':exp_cost' => $d['expCost'] ?? null,
                    ':max_weight' => $d['maxWeight'] ?? null,
                    ':min_character' => $d['minCharacter'] ?? null,
                    ':max_character' => $d['maxCharacter'] ?? null,
                    ':cost_help_coma' => $d['costHelpComa'] ?? null,
                    ':cost_max_characteristics' => $d['costMaxCharacteristics'] ?? null,
                    ':number_max_free_action' => $d['numberMaxFreeAction'] ?? null,
                ]);
            }
        }
    }

    public function saveLocations(int $storyId, array $locations): void
    {
        $stmtLoc = $this->pdo->prepare("
            INSERT INTO list_locations (
                id_story, id_text_name, id_text_description, is_safe, max_characters,
                id_event_on_enter, id_event_if_counter_zero, counter_start, id_card
            ) VALUES (
                :id_story, :id_text_name, :id_text_description, :is_safe, :max_characters,
                :id_event_on_enter, :id_event_if_counter_zero, :counter_start, :id_card
            )
        ");
        $stmtNei = $this->pdo->prepare("
            INSERT INTO list_locations_neighbors (
                id_story, id_location_from, id_location_to, direction, energy_cost, condition_key, condition_value
            ) VALUES (
                :id_story, :id_location_from, :id_location_to, :direction, :energy_cost, :condition_key, :condition_value
            )
        ");

        foreach ($locations as $loc) {
            $stmtLoc->execute([
                ':id_story' => $storyId,
                ':id_text_name' => $loc['idTextName'] ?? null,
                ':id_text_description' => $loc['idTextDescription'] ?? null,
                ':is_safe' => $loc['isSafe'] ?? 0,
                ':max_characters' => $loc['maxCharacters'] ?? null,
                ':id_event_on_enter' => $loc['idEventOnEnter'] ?? null,
                ':id_event_if_counter_zero' => $loc['idEventIfCounterZero'] ?? null,
                ':counter_start' => $loc['counterStart'] ?? null,
                ':id_card' => $loc['idCard'] ?? null,
            ]);
            $locId = (int)$this->pdo->lastInsertId();

            if (!empty($loc['neighbors'])) {
                foreach ($loc['neighbors'] as $n) {
                    $stmtNei->execute([
                        ':id_story' => $storyId,
                        ':id_location_from' => $locId,
                        ':id_location_to' => $n['idLocationTo'] ?? null,
                        ':direction' => $n['direction'] ?? null,
                        ':energy_cost' => $n['energyCost'] ?? 1,
                        ':condition_key' => $n['conditionKey'] ?? null,
                        ':condition_value' => $n['conditionValue'] ?? null,
                    ]);
                }
            }
        }
    }

    public function saveEvents(int $storyId, array $events): void
    {
        $stmtEv = $this->pdo->prepare("
            INSERT INTO list_events (
                id_story, id_text_name, id_text_description, event_type, trigger_type,
                energy_cost, coin_cost, id_event_next, flag_interrupt, flag_end_time, id_location
            ) VALUES (
                :id_story, :id_text_name, :id_text_description, :event_type, :trigger_type,
                :energy_cost, :coin_cost, :id_event_next, :flag_interrupt, :flag_end_time, :id_location
            )
        ");
        $stmtEf = $this->pdo->prepare("
            INSERT INTO list_events_effects (
                id_story, id_event, effect_type, effect_value, flag_group
            ) VALUES (
                :id_story, :id_event, :effect_type, :effect_value, :flag_group
            )
        ");

        foreach ($events as $ev) {
            $stmtEv->execute([
                ':id_story' => $storyId,
                ':id_text_name' => $ev['idTextName'] ?? null,
                ':id_text_description' => $ev['idTextDescription'] ?? null,
                ':event_type' => $ev['eventType'] ?? $ev['type'] ?? null,
                ':trigger_type' => $ev['triggerType'] ?? null,
                ':energy_cost' => $ev['energyCost'] ?? 0,
                ':coin_cost' => $ev['coinCost'] ?? 0,
                ':id_event_next' => $ev['idEventNext'] ?? null,
                ':flag_interrupt' => $ev['flagInterrupt'] ?? 0,
                ':flag_end_time' => $ev['flagEndTime'] ?? 0,
                ':id_location' => $ev['idLocation'] ?? null,
            ]);
            $evId = (int)$this->pdo->lastInsertId();

            if (!empty($ev['effects'])) {
                foreach ($ev['effects'] as $ef) {
                    $stmtEf->execute([
                        ':id_story' => $storyId,
                        ':id_event' => $evId,
                        ':effect_type' => $ef['effectType'] ?? $ef['type'] ?? null,
                        ':effect_value' => $ef['effectValue'] ?? $ef['value'] ?? null,
                        ':flag_group' => $ef['flagGroup'] ?? 0,
                    ]);
                }
            }
        }
    }

    public function saveItems(int $storyId, array $items): void
    {
        $stmtIt = $this->pdo->prepare("
            INSERT INTO list_items (id_story, id_text_name, id_text_description, weight, id_class)
            VALUES (:id_story, :id_text_name, :id_text_description, :weight, :id_class)
        ");
        $stmtEf = $this->pdo->prepare("
            INSERT INTO list_items_effects (id_story, id_item, effect_type, effect_value)
            VALUES (:id_story, :id_item, :effect_type, :effect_value)
        ");

        foreach ($items as $it) {
            $stmtIt->execute([
                ':id_story' => $storyId,
                ':id_text_name' => $it['idTextName'] ?? null,
                ':id_text_description' => $it['idTextDescription'] ?? null,
                ':weight' => $it['weight'] ?? 0,
                ':id_class' => $it['idClass'] ?? null,
            ]);
            $itId = (int)$this->pdo->lastInsertId();

            if (!empty($it['effects'])) {
                foreach ($it['effects'] as $ef) {
                    $stmtEf->execute([
                        ':id_story' => $storyId,
                        ':id_item' => $itId,
                        ':effect_type' => $ef['effectType'] ?? $ef['type'] ?? null,
                        ':effect_value' => $ef['effectValue'] ?? $ef['value'] ?? null,
                    ]);
                }
            }
        }
    }

    public function saveClasses(int $storyId, array $classes): void
    {
        $stmtCls = $this->pdo->prepare("
            INSERT INTO list_classes (
                id_story, uuid, id_text_name, id_text_description,
                weight_max, dexterity_base, intelligence_base, constitution_base
            ) VALUES (
                :id_story, :uuid, :id_text_name, :id_text_description,
                :weight_max, :dexterity_base, :intelligence_base, :constitution_base
            )
        ");
        $stmtBon = $this->pdo->prepare("
            INSERT INTO list_classes_bonus (id_story, id_class, bonus_type, bonus_value)
            VALUES (:id_story, :id_class, :bonus_type, :bonus_value)
        ");

        foreach ($classes as $cls) {
            $uuid = $cls['uuid'] ?? $this->generateUuid();
            $stmtCls->execute([
                ':id_story' => $storyId,
                ':uuid' => $uuid,
                ':id_text_name' => $cls['idTextName'] ?? null,
                ':id_text_description' => $cls['idTextDescription'] ?? null,
                ':weight_max' => $cls['weightMax'] ?? 0,
                ':dexterity_base' => $cls['dexterityBase'] ?? 0,
                ':intelligence_base' => $cls['intelligenceBase'] ?? 0,
                ':constitution_base' => $cls['constitutionBase'] ?? 0,
            ]);
            $clsId = (int)$this->pdo->lastInsertId();

            if (!empty($cls['bonuses'])) {
                foreach ($cls['bonuses'] as $b) {
                    $stmtBon->execute([
                        ':id_story' => $storyId,
                        ':id_class' => $clsId,
                        ':bonus_type' => $b['bonusType'] ?? $b['type'] ?? null,
                        ':bonus_value' => $b['bonusValue'] ?? $b['value'] ?? null,
                    ]);
                }
            }
        }
    }

    public function saveChoices(int $storyId, array $choices): void
    {
        $stmtCh = $this->pdo->prepare("
            INSERT INTO list_choices (
                id_story, id_event, id_text_name, id_text_description, priority, is_otherwise, is_progress, id_event_torun
            ) VALUES (
                :id_story, :id_event, :id_text_name, :id_text_description, :priority, :is_otherwise, :is_progress, :id_event_torun
            )
        ");
        $stmtCo = $this->pdo->prepare("
            INSERT INTO list_choices_conditions (
                id_story, id_choice, condition_type, condition_key, condition_value, condition_operator
            ) VALUES (
                :id_story, :id_choice, :condition_type, :condition_key, :condition_value, :condition_operator
            )
        ");
        $stmtEf = $this->pdo->prepare("
            INSERT INTO list_choices_effects (
                id_story, id_choice, effect_type, effect_value, flag_group
            ) VALUES (
                :id_story, :id_choice, :effect_type, :effect_value, :flag_group
            )
        ");

        foreach ($choices as $ch) {
            $stmtCh->execute([
                ':id_story' => $storyId,
                ':id_event' => $ch['idEvent'] ?? null,
                ':id_text_name' => $ch['idTextName'] ?? null,
                ':id_text_description' => $ch['idTextDescription'] ?? null,
                ':priority' => $ch['priority'] ?? 0,
                ':is_otherwise' => $ch['isOtherwise'] ?? 0,
                ':is_progress' => $ch['isProgress'] ?? 0,
                ':id_event_torun' => $ch['idEventToRun'] ?? null,
            ]);
            $chId = (int)$this->pdo->lastInsertId();

            if (!empty($ch['conditions'])) {
                foreach ($ch['conditions'] as $co) {
                    $stmtCo->execute([
                        ':id_story' => $storyId,
                        ':id_choice' => $chId,
                        ':condition_type' => $co['conditionType'] ?? $co['type'] ?? null,
                        ':condition_key' => $co['conditionKey'] ?? null,
                        ':condition_value' => $co['conditionValue'] ?? null,
                        ':condition_operator' => $co['conditionOperator'] ?? 'AND',
                    ]);
                }
            }

            if (!empty($ch['effects'])) {
                foreach ($ch['effects'] as $ef) {
                    $stmtEf->execute([
                        ':id_story' => $storyId,
                        ':id_choice' => $chId,
                        ':effect_type' => $ef['effectType'] ?? $ef['type'] ?? null,
                        ':effect_value' => $ef['effectValue'] ?? $ef['value'] ?? null,
                        ':flag_group' => $ef['flagGroup'] ?? 0,
                    ]);
                }
            }
        }
    }

    public function saveCards(int $storyId, array $cards): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO list_cards (
                id_story, uuid, card_type, id_text_name, id_text_title, id_text_description,
                id_text_copyright, link_copyright, id_creator, image_url, id_reference,
                alternative_image, awesome_icon, style_main, style_detail
            ) VALUES (
                :id_story, :uuid, :card_type, :id_text_name, :id_text_title, :id_text_description,
                :id_text_copyright, :link_copyright, :id_creator, :image_url, :id_reference,
                :alternative_image, :awesome_icon, :style_main, :style_detail
            )
        ");
        foreach ($cards as $c) {
            $uuid = $c['uuid'] ?? $this->generateUuid();
            $stmt->execute([
                ':id_story' => $storyId,
                ':uuid' => $uuid,
                ':card_type' => $c['cardType'] ?? null,
                ':id_text_name' => $c['idTextName'] ?? null,
                ':id_text_title' => $c['idTextTitle'] ?? null,
                ':id_text_description' => $c['idTextDescription'] ?? null,
                ':id_text_copyright' => $c['idTextCopyright'] ?? null,
                ':link_copyright' => $c['linkCopyright'] ?? null,
                ':id_creator' => $c['idCreator'] ?? null,
                ':image_url' => $c['imageUrl'] ?? null,
                ':id_reference' => $c['idReference'] ?? null,
                ':alternative_image' => $c['alternativeImage'] ?? null,
                ':awesome_icon' => $c['awesomeIcon'] ?? null,
                ':style_main' => $c['styleMain'] ?? null,
                ':style_detail' => $c['styleDetail'] ?? null,
            ]);
        }
    }

    public function saveKeys(int $storyId, array $keys): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO list_keys (id_story, key_name, key_value, key_group, is_visible)
            VALUES (:id_story, :key_name, :key_value, :key_group, :is_visible)
        ");
        foreach ($keys as $k) {
            $stmt->execute([
                ':id_story' => $storyId,
                ':key_name' => $k['keyName'] ?? null,
                ':key_value' => $k['keyValue'] ?? null,
                ':key_group' => $k['keyGroup'] ?? null,
                ':is_visible' => $k['isVisible'] ?? 0,
            ]);
        }
    }

    public function saveTraits(int $storyId, array $traits): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO list_traits (
                id_story, uuid, id_text_name, id_text_description,
                cost_positive, cost_negative, id_class_permitted, id_class_prohibited
            ) VALUES (
                :id_story, :uuid, :id_text_name, :id_text_description,
                :cost_positive, :cost_negative, :id_class_permitted, :id_class_prohibited
            )
        ");
        foreach ($traits as $t) {
            $uuid = $t['uuid'] ?? $this->generateUuid();
            $stmt->execute([
                ':id_story' => $storyId,
                ':uuid' => $uuid,
                ':id_text_name' => $t['idTextName'] ?? null,
                ':id_text_description' => $t['idTextDescription'] ?? null,
                ':cost_positive' => $t['costPositive'] ?? 0,
                ':cost_negative' => $t['costNegative'] ?? 0,
                ':id_class_permitted' => $t['idClassPermitted'] ?? null,
                ':id_class_prohibited' => $t['idClassProhibited'] ?? null,
            ]);
        }
    }

    public function saveCharacterTemplates(int $storyId, array $templates): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO list_character_templates (
                id_story, uuid, id_tipo, id_text_name, id_text_description,
                life_max, energy_max, sad_max, dexterity_start, intelligence_start, constitution_start
            ) VALUES (
                :id_story, :uuid, :id_tipo, :id_text_name, :id_text_description,
                :life_max, :energy_max, :sad_max, :dexterity_start, :intelligence_start, :constitution_start
            )
        ");
        foreach ($templates as $t) {
            $uuid = $t['uuid'] ?? $this->generateUuid();
            $stmt->execute([
                ':id_story' => $storyId,
                ':uuid' => $uuid,
                ':id_tipo' => $t['idTipo'] ?? null,
                ':id_text_name' => $t['idTextName'] ?? null,
                ':id_text_description' => $t['idTextDescription'] ?? null,
                ':life_max' => $t['lifeMax'] ?? 0,
                ':energy_max' => $t['energyMax'] ?? 0,
                ':sad_max' => $t['sadMax'] ?? 0,
                ':dexterity_start' => $t['dexterityStart'] ?? 0,
                ':intelligence_start' => $t['intelligenceStart'] ?? 0,
                ':constitution_start' => $t['constitutionStart'] ?? 0,
            ]);
        }
    }

    public function saveWeatherRules(int $storyId, array $rules): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO list_weather_rules (
                id_story, id_text_name, probability, delta_energy, id_event, condition_key, condition_value, time_start, time_end, is_active
            ) VALUES (
                :id_story, :id_text_name, :probability, :delta_energy, :id_event, :condition_key, :condition_value, :time_start, :time_end, :is_active
            )
        ");
        foreach ($rules as $r) {
            $stmt->execute([
                ':id_story' => $storyId,
                ':id_text_name' => $r['idTextName'] ?? null,
                ':probability' => $r['probability'] ?? null,
                ':delta_energy' => $r['deltaEnergy'] ?? 0,
                ':id_event' => $r['idEvent'] ?? null,
                ':condition_key' => $r['conditionKey'] ?? null,
                ':condition_value' => $r['conditionValue'] ?? null,
                ':time_start' => $r['timeStart'] ?? null,
                ':time_end' => $r['timeEnd'] ?? null,
                ':is_active' => $r['isActive'] ?? 1,
            ]);
        }
    }

    public function saveGlobalRandomEvents(int $storyId, array $events): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO list_global_random_events (
                id_story, id_event, probability, condition_key, condition_value
            ) VALUES (
                :id_story, :id_event, :probability, :condition_key, :condition_value
            )
        ");
        foreach ($events as $e) {
            $stmt->execute([
                ':id_story' => $storyId,
                ':id_event' => $e['idEvent'] ?? null,
                ':probability' => $e['probability'] ?? null,
                ':condition_key' => $e['conditionKey'] ?? null,
                ':condition_value' => $e['conditionValue'] ?? null,
            ]);
        }
    }

    public function saveMissions(int $storyId, array $missions): void
    {
        $stmtM = $this->pdo->prepare("
            INSERT INTO list_missions (
                id_story, id_text_name, id_text_description, condition_key, condition_value_from, condition_value_to, id_event_completed
            ) VALUES (
                :id_story, :id_text_name, :id_text_description, :condition_key, :condition_value_from, :condition_value_to, :id_event_completed
            )
        ");
        $stmtS = $this->pdo->prepare("
            INSERT INTO list_missions_steps (
                id_story, id_mission, step_order, id_text_description, condition_key, condition_value, id_event_completed
            ) VALUES (
                :id_story, :id_mission, :step_order, :id_text_description, :condition_key, :condition_value, :id_event_completed
            )
        ");

        foreach ($missions as $m) {
            $stmtM->execute([
                ':id_story' => $storyId,
                ':id_text_name' => $m['idTextName'] ?? null,
                ':id_text_description' => $m['idTextDescription'] ?? null,
                ':condition_key' => $m['conditionKey'] ?? null,
                ':condition_value_from' => $m['conditionValueFrom'] ?? null,
                ':condition_value_to' => $m['conditionValueTo'] ?? null,
                ':id_event_completed' => $m['idEventCompleted'] ?? null,
            ]);
            $mId = (int)$this->pdo->lastInsertId();

            if (!empty($m['steps'])) {
                foreach ($m['steps'] as $idx => $s) {
                    $stmtS->execute([
                        ':id_story' => $storyId,
                        ':id_mission' => $mId,
                        ':step_order' => $s['stepOrder'] ?? ($idx + 1),
                        ':id_text_description' => $s['idTextDescription'] ?? null,
                        ':condition_key' => $s['conditionKey'] ?? null,
                        ':condition_value' => $s['conditionValue'] ?? null,
                        ':id_event_completed' => $s['idEventCompleted'] ?? null,
                    ]);
                }
            }
        }
    }

    public function saveCreators(int $storyId, array $creators): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO list_creator (
                id_story, uuid, id_text, creator_name, creator_role, link,
                url, url_image, url_emote, url_instagram
            ) VALUES (
                :id_story, :uuid, :id_text, :creator_name, :creator_role, :link,
                :url, :url_image, :url_emote, :url_instagram
            )
        ");
        foreach ($creators as $c) {
            $stmt->execute([
                ':id_story' => $storyId,
                ':uuid' => $c['uuid'] ?? null,
                ':id_text' => $c['idText'] ?? null,
                ':creator_name' => $c['creatorName'] ?? null,
                ':creator_role' => $c['creatorRole'] ?? null,
                ':link' => $c['link'] ?? null,
                ':url' => $c['url'] ?? null,
                ':url_image' => $c['urlImage'] ?? null,
                ':url_emote' => $c['urlEmote'] ?? null,
                ':url_instagram' => $c['urlInstagram'] ?? null,
            ]);
        }
    }

    private function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    // Step 17: Generic entity CRUD

    private const ALLOWED_TABLES = [
        'list_stories_difficulty', 'list_locations', 'list_locations_neighbors',
        'list_events', 'list_events_effects',
        'list_items', 'list_items_effects',
        'list_character_templates', 'list_classes', 'list_classes_bonus',
        'list_traits', 'list_creator', 'list_cards', 'list_texts',
        'list_keys',
        'list_choices', 'list_choices_conditions', 'list_choices_effects',
        'list_weather_rules', 'list_global_random_events',
        'list_missions', 'list_missions_steps',
    ];

    public function saveEntity(int $storyId, string $tableName, array $data): void
    {
        if (!in_array($tableName, self::ALLOWED_TABLES, true)) {
            return;
        }
        $columns = $this->getTableColumns($tableName);
        $insertCols = ['id_story'];
        $placeholders = [':id_story'];
        $params = [':id_story' => $storyId];

        // Handle explicit id
        $explicitId = self::getLong($data, 'id');
        if ($explicitId !== null) {
            $insertCols[] = 'id';
            $placeholders[] = ':id';
            $params[':id'] = $explicitId;
        }

        foreach ($columns as $col) {
            if ($col === 'id' || $col === 'id_story') continue;
            $camelKey = $this->toCamel($col);
            $value = $data[$camelKey] ?? $data[$col] ?? null;
            if ($value !== null) {
                $insertCols[] = $col;
                $placeholders[] = ":$col";
                $params[":$col"] = $value;
            }
        }
        $colStr = implode(', ', $insertCols);
        $phStr = implode(', ', $placeholders);
        $stmt = $this->pdo->prepare("INSERT INTO $tableName ($colStr) VALUES ($phStr)");
        $stmt->execute($params);
    }

    public function updateEntity(int $storyId, string $tableName, string $uuid, array $data): void
    {
        if (!in_array($tableName, self::ALLOWED_TABLES, true)) {
            return;
        }
        $columns = $this->getTableColumns($tableName);
        $sets = [];
        $params = [':id_story' => $storyId, ':uuid' => $uuid];

        foreach ($columns as $col) {
            if (in_array($col, ['id', 'id_story', 'uuid'], true)) continue;
            $camelKey = $this->toCamel($col);
            if (array_key_exists($camelKey, $data)) {
                $sets[] = "$col = :$col";
                $params[":$col"] = $data[$camelKey];
            } elseif (array_key_exists($col, $data)) {
                $sets[] = "$col = :$col";
                $params[":$col"] = $data[$col];
            }
        }
        if (empty($sets)) return;
        $setStr = implode(', ', $sets);
        $stmt = $this->pdo->prepare("UPDATE $tableName SET $setStr WHERE id_story = :id_story AND uuid = :uuid");
        $stmt->execute($params);
    }

    public function deleteEntityByUuid(string $tableName, string $uuid): void
    {
        if (!in_array($tableName, self::ALLOWED_TABLES, true)) {
            return;
        }
        $stmt = $this->pdo->prepare("DELETE FROM $tableName WHERE uuid = :uuid");
        $stmt->execute([':uuid' => $uuid]);
    }

    public function updateStoryById(int $storyId, array $data): void
    {
        $fieldMap = [
            'author' => 'author', 'category' => 'category', 'group' => 'group_name',
            'visibility' => 'visibility', 'priority' => 'priority', 'peghi' => 'peghi',
            'versionMin' => 'version_min', 'versionMax' => 'version_max',
            'idTextTitle' => 'id_text_title', 'idTextDescription' => 'id_text_description',
            'idTextClockSingular' => 'id_text_clock_singular', 'idTextClockPlural' => 'id_text_clock_plural',
            'idLocationStart' => 'id_location_start', 'idImage' => 'id_image',
            'idLocationAllPlayerComa' => 'id_location_all_player_coma', 'idEventAllPlayerComa' => 'id_event_all_player_coma',
            'idEventEndGame' => 'id_event_end_game', 'idTextCopyright' => 'id_text_copyright',
            'linkCopyright' => 'link_copyright', 'idCreator' => 'id_creator', 'idCard' => 'id_card',
        ];
        $sets = [];
        $params = [':id' => $storyId];
        foreach ($fieldMap as $jsonKey => $dbCol) {
            if (array_key_exists($jsonKey, $data)) {
                $sets[] = "$dbCol = :$dbCol";
                $params[":$dbCol"] = $data[$jsonKey];
            }
        }
        if (empty($sets)) return;
        $setStr = implode(', ', $sets);
        $stmt = $this->pdo->prepare("UPDATE list_stories SET $setStr WHERE id = :id");
        $stmt->execute($params);
    }

    private function getTableColumns(string $tableName): array
    {
        // Return known column sets for each table (MySQL-compatible)
        $columnMap = [
            'list_stories_difficulty' => ['id', 'id_story', 'uuid', 'id_text_name', 'id_text_description', 'exp_cost', 'max_weight', 'min_character', 'max_character', 'cost_help_coma', 'cost_max_characteristics', 'number_max_free_action'],
            'list_locations' => ['id', 'id_story', 'uuid', 'id_text_name', 'id_text_description', 'is_safe', 'max_characters', 'id_event_on_enter', 'id_event_if_counter_zero', 'counter_start', 'id_card'],
            'list_locations_neighbors' => ['id', 'id_story', 'id_card', 'id_text_name', 'id_text_description', 'id_location_from', 'id_location_to', 'direction', 'energy_cost', 'condition_key', 'condition_value'],
            'list_events' => ['id', 'id_story', 'uuid', 'id_text_name', 'id_text_description', 'event_type', 'trigger_type', 'energy_cost', 'coin_cost', 'id_event_next', 'flag_interrupt', 'flag_end_time', 'id_location'],
            'list_events_effects' => ['id', 'id_story', 'id_card', 'id_text_name', 'id_text_description', 'id_event', 'effect_type', 'effect_value', 'flag_group'],
            'list_items' => ['id', 'id_story', 'uuid', 'id_text_name', 'id_text_description', 'weight', 'id_class'],
            'list_items_effects' => ['id', 'id_story', 'id_card', 'id_item', 'effect_type', 'effect_value'],
            'list_character_templates' => ['id', 'id_story', 'uuid', 'id_tipo', 'id_text_name', 'id_text_description', 'life_max', 'energy_max', 'sad_max', 'dexterity_start', 'intelligence_start', 'constitution_start'],
            'list_classes' => ['id', 'id_story', 'uuid', 'id_text_name', 'id_text_description', 'weight_max', 'dexterity_base', 'intelligence_base', 'constitution_base'],
            'list_classes_bonus' => ['id', 'id_story', 'id_class', 'bonus_type', 'bonus_value'],
            'list_traits' => ['id', 'id_story', 'uuid', 'id_text_name', 'id_text_description', 'cost_positive', 'cost_negative', 'id_class_permitted', 'id_class_prohibited'],
            'list_creator' => ['id', 'id_story', 'uuid', 'id_card', 'id_text_name', 'id_text_description', 'id_text', 'creator_name', 'creator_role', 'link', 'url', 'url_image', 'url_emote', 'url_instagram'],
            'list_cards' => ['id', 'id_story', 'uuid', 'id_card', 'card_type', 'id_text_name', 'id_text_title', 'id_text_description', 'id_text_copyright', 'image_url', 'alternative_image', 'awesome_icon', 'style_main', 'style_detail', 'link_copyright', 'id_creator', 'id_reference'],
            'list_texts' => ['id', 'id_story', 'uuid', 'id_card', 'id_text_name', 'id_text_description', 'id_text', 'lang', 'short_text', 'long_text', 'id_text_copyright', 'link_copyright', 'id_creator'],
            'list_keys' => ['id', 'uuid', 'id_story', 'id_text_name', 'key_name', 'key_value', 'key_group', 'is_visible'],
            'list_choices' => ['id', 'uuid', 'id_story', 'id_event', 'id_text_name', 'id_text_description', 'priority', 'is_otherwise', 'is_progress', 'id_event_torun'],
            'list_choices_conditions' => ['id', 'id_story', 'id_card', 'id_choice', 'condition_type', 'condition_key', 'condition_value', 'condition_operator'],
            'list_choices_effects' => ['id', 'id_story', 'id_card', 'id_text_name', 'id_text_description', 'id_choice', 'effect_type', 'effect_value', 'flag_group'],
            'list_weather_rules' => ['id', 'id_story', 'id_text_name', 'probability', 'delta_energy', 'id_event', 'condition_key', 'condition_value', 'time_start', 'time_end', 'is_active'],
            'list_global_random_events' => ['id', 'id_story', 'id_text_name', 'id_text_description', 'id_event', 'probability', 'condition_key', 'condition_value'],
            'list_missions' => ['id', 'uuid', 'id_story', 'id_text_name', 'id_text_description', 'condition_key', 'condition_value_from', 'condition_value_to', 'id_event_completed'],
            'list_missions_steps' => ['id', 'id_story', 'id_mission', 'step_order', 'id_text_description', 'condition_key', 'condition_value', 'id_event_completed'],
        ];
        return $columnMap[$tableName] ?? [];
    }

    private function toCamel(string $snake): string
    {
        $parts = explode('_', $snake);
        $first = array_shift($parts);
        return $first . implode('', array_map('ucfirst', $parts));
    }

    // === Explicit-ID import support ===

    private const SYNC_TABLES = [
        ['list_stories', 'id'], ['list_texts', 'id'], ['list_stories_difficulty', 'id'],
        ['list_creator', 'id'], ['list_cards', 'id'], ['list_keys', 'id'],
        ['list_classes', 'id'], ['list_traits', 'id'], ['list_character_templates', 'id'],
        ['list_locations', 'id'], ['list_events', 'id'], ['list_items', 'id'],
        ['list_choices', 'id'], ['list_weather_rules', 'id'],
        ['list_global_random_events', 'id'], ['list_missions', 'id'],
    ];

    public function existsStoryId(int $storyId): bool
    {
        $stmt = $this->pdo->prepare('SELECT COUNT(1) FROM list_stories WHERE id = :id');
        $stmt->execute([':id' => $storyId]);
        return (int)$stmt->fetchColumn() > 0;
    }

    public function existsEntityId(string $tableName, string $idColumn, int $entityId, int $storyId): bool
    {
        if (!in_array($tableName, self::ALLOWED_TABLES, true)) {
            return false;
        }
        $stmt = $this->pdo->prepare("SELECT COUNT(1) FROM {$tableName} WHERE {$idColumn} = :eid AND id_story = :sid");
        $stmt->execute([':eid' => $entityId, ':sid' => $storyId]);
        return (int)$stmt->fetchColumn() > 0;
    }

    public function nextScopedId(string $tableName, string $idColumn, int $storyId): int
    {
        if (!in_array($tableName, self::ALLOWED_TABLES, true)) {
            return 1;
        }
        $stmt = $this->pdo->prepare("SELECT COALESCE(MAX({$idColumn}), 0) + 1 FROM {$tableName} WHERE id_story = :sid");
        $stmt->execute([':sid' => $storyId]);
        return (int)$stmt->fetchColumn();
    }

    public function nextGlobalId(string $tableName, string $idColumn): int
    {
        if (!in_array($tableName, self::ALLOWED_TABLES, true)) {
            return 1;
        }
        $stmt = $this->pdo->prepare("SELECT COALESCE(MAX({$idColumn}), 0) + 1 FROM {$tableName}");
        $stmt->execute();
        return (int)$stmt->fetchColumn();
    }

    public function syncSequences(): void
    {
        // Detect PostgreSQL driver
        $driver = $this->pdo->getAttribute(\PDO::ATTR_DRIVER_NAME);
        if ($driver !== 'pgsql') {
            return;
        }
        foreach (self::SYNC_TABLES as [$table, $col]) {
            try {
                $sql = "SELECT setval(pg_get_serial_sequence('{$table}', '{$col}'), "
                     . "COALESCE((SELECT MAX({$col}) FROM {$table}), 1), true)";
                $this->pdo->query($sql);
            } catch (\Exception $e) {
                // Sequence may not exist
            }
        }
    }

    private static function getLong(array $data, string ...$keys): ?int
    {
        foreach ($keys as $key) {
            if (isset($data[$key])) {
                $v = $data[$key];
                if (is_int($v)) return $v;
                if (is_numeric($v)) return (int)$v;
            }
        }
        return null;
    }
}
