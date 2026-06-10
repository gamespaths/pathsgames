<?php

declare(strict_types=1);

namespace Games\Paths\Core\Service\Story;

use Games\Paths\Core\Domain\Story\StoryValidationReport;
use Games\Paths\Core\Port\Story\StoryReadPort;
use Games\Paths\Core\Port\Story\StoryValidatorPort;

/**
 * StoryValidatorService - referential-integrity and domain-rule validator (Step 22).
 *
 * Mirrors the Java reference. Import-map and persisted-story paths both build one graph
 * and feed it through a single rule engine. Only positive references are validated
 * (null / absent / <= 0 means "none"). Field access is key-agnostic (camel or snake).
 */
final class StoryValidatorService implements StoryValidatorPort
{
    private const LOCATION = 'location';
    private const EVENT = 'event';
    private const ITEM = 'item';
    private const CHOICE = 'choice';
    private const CLAS = 'class';
    private const MISSION = 'mission';

    private const REF_RULES = [
        self::LOCATION => 'R_LOCATION_REF',
        self::EVENT => 'R_EVENT_REF',
        self::ITEM => 'R_ITEM_REF',
        self::CHOICE => 'R_CHOICE_REF',
        self::CLAS => 'R_CLASS_REF',
        self::MISSION => 'R_MISSION_REF',
    ];

    public function __construct(private readonly StoryReadPort $readPort)
    {
    }

    // ----- entry points -----

    public function validateImportData(array $storyData): StoryValidationReport
    {
        $report = new StoryValidationReport();
        if (empty($storyData)) {
            $report->add('R0_EMPTY', 'story', null, null, 'story data is null or empty');
            return $report;
        }
        $this->runRules($this->buildFromMap($storyData), $report);
        return $report;
    }

    public function validateStory(int $storyId): StoryValidationReport
    {
        $report = new StoryValidationReport();
        $this->runRules($this->buildFromDb($storyId), $report);
        return $report;
    }

    public function validateStoryByUuid(string $uuid): ?StoryValidationReport
    {
        $story = $this->readPort->findStoryByUuid($uuid);
        if ($story === null) {
            return null;
        }
        return $this->validateStory((int) self::field($story, 'id'));
    }

    public function validateEntity(string $entityType, array $data): StoryValidationReport
    {
        $report = new StoryValidationReport();
        if ($entityType === '' || empty($data)) {
            return $report;
        }
        $eid = self::str(self::field($data, 'id'));
        if ($entityType === 'character-templates') {
            $this->templateLocal($entityType, $eid, $data, $report);
        } elseif ($entityType === 'items' || $entityType === 'traits') {
            $this->classConflictLocal($entityType, $eid, $data, $report);
        } elseif ($entityType === 'difficulties') {
            $this->difficultyLocal($entityType, $eid, $data, $report);
        }
        return $report;
    }

    // ----- rule engine -----

    private function runRules(array $g, StoryValidationReport $report): void
    {
        $this->validateRefs($g, $report);
        $this->validateNeighbors($g, $report);
        $this->validateEventChains($g, $report);
        $this->validateChoiceOptions($g, $report);
        $this->validateKeys($g, $report);
        $this->validateTemplates($g, $report);
        $this->validateRestrictions($g, $report);
    }

    private function validateRefs(array $g, StoryValidationReport $report): void
    {
        $universe = [
            self::LOCATION => $g['locations'], self::EVENT => $g['events'], self::ITEM => $g['items'],
            self::CHOICE => $g['choices'], self::CLAS => $g['classes'], self::MISSION => $g['missions'],
        ];
        foreach ($g['refs'] as [$rule, $etype, $eid, $field, $target, $value]) {
            if ($value !== null && $value > 0 && !isset($universe[$target][$value])) {
                $report->add($rule, $etype, $eid, $field, "{$etype} {$field}={$value} references a non-existent {$target}");
            }
        }
    }

    private function validateNeighbors(array $g, StoryValidationReport $report): void
    {
        $seen = [];
        foreach ($g['neighbors'] as [$eid, $frm, $to, $direction]) {
            if ($frm !== null && $to !== null && $frm > 0 && $frm === $to) {
                $report->add('R2_NEIGHBOR_SELF', 'location-neighbors', $eid, 'idLocationTo', "neighbor links location {$frm} to itself");
            }
            if ($direction === null || trim((string) $direction) === '') {
                $report->add('R2_NEIGHBOR_DIR', 'location-neighbors', $eid, 'direction', "neighbor from location {$frm} has no direction");
            } elseif ($frm !== null && $frm > 0) {
                $key = $frm . '/' . strtoupper(trim((string) $direction));
                if (array_key_exists($key, $seen) && $seen[$key] !== $to) {
                    $report->add('R2_NEIGHBOR_DUP', 'location-neighbors', $eid, 'direction', "location {$frm} has two neighbors in direction {$direction}");
                }
                $seen[$key] = $to;
            }
        }
    }

    private function validateEventChains(array $g, StoryValidationReport $report): void
    {
        $color = []; // 0=visiting 1=done
        foreach (array_keys($g['events']) as $start) {
            if (isset($color[$start])) {
                continue;
            }
            $stack = [$start];
            while (!empty($stack)) {
                $cur = end($stack);
                $c = $color[$cur] ?? null;
                if ($c === null) {
                    $color[$cur] = 0;
                    $nxt = $g['eventNext'][$cur] ?? null;
                    if ($nxt !== null && $nxt > 0 && isset($g['events'][$nxt])) {
                        $nc = $color[$nxt] ?? null;
                        if ($nc === 0) {
                            $report->add('R3_EVENT_CYCLE', 'events', (string) $cur, 'idEventNext', "event chain forms a cycle at event {$cur} -> {$nxt}");
                            $color[$cur] = 1;
                            array_pop($stack);
                        } elseif ($nc === null) {
                            $stack[] = $nxt;
                        } else {
                            $color[$cur] = 1;
                            array_pop($stack);
                        }
                    } else {
                        $color[$cur] = 1;
                        array_pop($stack);
                    }
                } else {
                    $color[$cur] = 1;
                    array_pop($stack);
                }
            }
        }
    }

    private function validateChoiceOptions(array $g, StoryValidationReport $report): void
    {
        foreach ($g['choiceOtherwise'] as $cid => $otherwise) {
            if (!$otherwise && !isset($g['choicesWithOption'][$cid])) {
                $report->add('R4_CHOICE_EMPTY', 'choices', (string) $cid, null, "choice {$cid} has no option (choice-effects) and no otherwise fallback");
            }
        }
    }

    private function validateKeys(array $g, StoryValidationReport $report): void
    {
        foreach ($g['keyRefs'] as [$eid, $ctype, $key]) {
            if ($key !== null && trim((string) $key) !== '' && !isset($g['keyNames'][strtolower(trim((string) $key))])) {
                $report->add('R4_CONDITION_KEY', 'choice-conditions', $eid, 'key', "choice-condition references unknown registry key '{$key}'");
            }
        }
    }

    private function validateTemplates(array $g, StoryValidationReport $report): void
    {
        foreach ($g['templates'] as [$eid, $lifeMax, $energyMax, $dex, $intel, $con, $sadMax]) {
            $this->positive($report, 'character-templates', $eid, 'lifeMax', $lifeMax);
            $this->positive($report, 'character-templates', $eid, 'energyMax', $energyMax);
            $this->nonNegative($report, 'character-templates', $eid, 'dexterityStart', $dex);
            $this->nonNegative($report, 'character-templates', $eid, 'intelligenceStart', $intel);
            $this->nonNegative($report, 'character-templates', $eid, 'constitutionStart', $con);
            $this->nonNegative($report, 'character-templates', $eid, 'sadMax', $sadMax);
        }
    }

    private function validateRestrictions(array $g, StoryValidationReport $report): void
    {
        foreach ($g['restrictions'] as [$etype, $eid, $permitted, $prohibited]) {
            if ($permitted !== null && $prohibited !== null && $permitted > 0 && $permitted === $prohibited) {
                $report->add('R6_CLASS_CONFLICT', $etype, $eid, 'idClassPermitted', "{$etype} {$eid} has the same class permitted and prohibited ({$permitted})");
            }
        }
    }

    // ----- entity-local -----

    private function templateLocal(string $t, ?string $eid, array $d, StoryValidationReport $r): void
    {
        $this->positive($r, $t, $eid, 'lifeMax', self::asInt(self::field($d, 'lifeMax')));
        $this->positive($r, $t, $eid, 'energyMax', self::asInt(self::field($d, 'energyMax')));
        $this->nonNegative($r, $t, $eid, 'dexterityStart', self::asInt(self::field($d, 'dexterityStart')));
        $this->nonNegative($r, $t, $eid, 'intelligenceStart', self::asInt(self::field($d, 'intelligenceStart')));
        $this->nonNegative($r, $t, $eid, 'constitutionStart', self::asInt(self::field($d, 'constitutionStart')));
        $this->nonNegative($r, $t, $eid, 'sadMax', self::asInt(self::field($d, 'sadMax')));
        $this->classConflictLocal($t, $eid, $d, $r);
    }

    private function classConflictLocal(string $t, ?string $eid, array $d, StoryValidationReport $r): void
    {
        $permitted = self::asInt(self::field($d, 'idClassPermitted'));
        $prohibited = self::asInt(self::field($d, 'idClassProhibited'));
        if ($permitted !== null && $prohibited !== null && $permitted > 0 && $permitted === $prohibited) {
            $r->add('R6_CLASS_CONFLICT', $t, $eid, 'idClassPermitted', "{$t} has the same class permitted and prohibited ({$permitted})");
        }
    }

    private function difficultyLocal(string $t, ?string $eid, array $d, StoryValidationReport $r): void
    {
        $min = self::asInt(self::field($d, 'minCharacter'));
        $max = self::asInt(self::field($d, 'maxCharacter'));
        if ($min !== null && $max !== null && $max > 0 && $min > $max) {
            $r->add('R6_DIFFICULTY_RANGE', $t, $eid, 'minCharacter', "minCharacter ({$min}) exceeds maxCharacter ({$max})");
        }
    }

    private function positive(StoryValidationReport $r, string $t, ?string $eid, string $field, ?int $v): void
    {
        if ($v !== null && $v <= 0) {
            $r->add('R6_STAT_RANGE', $t, $eid, $field, "{$field} must be positive but is {$v}");
        }
    }

    private function nonNegative(StoryValidationReport $r, string $t, ?string $eid, string $field, ?int $v): void
    {
        if ($v !== null && $v < 0) {
            $r->add('R6_STAT_RANGE', $t, $eid, $field, "{$field} must not be negative but is {$v}");
        }
    }

    // ----- graph builders -----

    private function newGraph(): array
    {
        return [
            'locations' => [], 'events' => [], 'items' => [], 'choices' => [], 'classes' => [], 'missions' => [],
            'keyNames' => [], 'refs' => [], 'neighbors' => [], 'keyRefs' => [], 'restrictions' => [], 'templates' => [],
            'eventNext' => [], 'choiceOtherwise' => [], 'choicesWithOption' => [],
        ];
    }

    private function buildFromMap(array $data): array
    {
        $g = $this->newGraph();
        $this->collectIds($g['locations'], $data['locations'] ?? []);
        $this->collectIds($g['events'], $data['events'] ?? []);
        $this->collectIds($g['items'], $data['items'] ?? []);
        $this->collectIds($g['choices'], $data['choices'] ?? []);
        $this->collectIds($g['classes'], $data['classes'] ?? []);
        $this->collectIds($g['missions'], $data['missions'] ?? []);
        foreach ($data['keys'] ?? [] as $k) {
            $name = self::field($k, 'name');
            if ($name !== null) {
                $g['keyNames'][strtolower(trim((string) $name))] = true;
            }
        }

        $this->ref($g, 'story', null, 'idLocationStart', self::LOCATION, self::asInt($data['idLocationStart'] ?? null));
        $this->ref($g, 'story', null, 'idLocationAllPlayerComa', self::LOCATION, self::asInt($data['idLocationAllPlayerComa'] ?? null));
        $this->ref($g, 'story', null, 'idEventAllPlayerComa', self::EVENT, self::asInt($data['idEventAllPlayerComa'] ?? null));
        $this->ref($g, 'story', null, 'idEventEndGame', self::EVENT, self::asInt($data['idEventEndGame'] ?? null));

        foreach ($data['events'] ?? [] as $e) {
            $this->collectEvent($g, $e);
        }
        foreach ($data['choices'] ?? [] as $c) {
            $this->collectChoice($g, $c);
        }
        foreach ($data['choiceEffects'] ?? [] as $ce) {
            $cid = self::asInt(self::field($ce, 'idChoices'));
            if ($cid !== null) {
                $g['choicesWithOption'][$cid] = true;
            }
            $this->ref($g, 'choice-effects', self::str(self::field($ce, 'id')), 'idChoices', self::CHOICE, $cid);
        }
        foreach ($data['choiceConditions'] ?? [] as $cc) {
            $this->ref($g, 'choice-conditions', self::str(self::field($cc, 'id')), 'idChoices', self::CHOICE, self::asInt(self::field($cc, 'idChoices')));
            $g['keyRefs'][] = [self::str(self::field($cc, 'id')), self::field($cc, 'type'), self::field($cc, 'key')];
        }
        foreach ($data['eventEffects'] ?? [] as $ee) {
            $this->collectEventEffect($g, $ee);
        }
        foreach ($data['itemEffects'] ?? [] as $ie) {
            $this->ref($g, 'item-effects', self::str(self::field($ie, 'id')), 'idItem', self::ITEM, self::asInt(self::field($ie, 'idItem')));
        }
        foreach ($data['classBonuses'] ?? [] as $cb) {
            $this->ref($g, 'class-bonuses', self::str(self::field($cb, 'id')), 'idClass', self::CLAS, self::asInt(self::field($cb, 'idClass')));
        }
        foreach ($data['missionSteps'] ?? [] as $ms) {
            $this->ref($g, 'mission-steps', self::str(self::field($ms, 'id')), 'idMission', self::MISSION, self::asInt(self::field($ms, 'idMission')));
        }
        foreach ($data['weatherRules'] ?? [] as $wr) {
            $this->ref($g, 'weather-rules', self::str(self::field($wr, 'id')), 'idEvent', self::EVENT, self::asInt(self::field($wr, 'idEvent')));
        }
        foreach ($data['globalRandomEvents'] ?? [] as $gr) {
            $this->ref($g, 'global-random-events', self::str(self::field($gr, 'id')), 'idEvent', self::EVENT, self::asInt(self::field($gr, 'idEvent')));
        }
        foreach ($data['locationNeighbors'] ?? [] as $n) {
            $this->collectNeighbor($g, $n);
        }
        foreach ($data['items'] ?? [] as $it) {
            $this->restriction($g, 'items', self::str(self::field($it, 'id')), self::field($it, 'idClassPermitted'), self::field($it, 'idClassProhibited'));
        }
        foreach ($data['traits'] ?? [] as $tr) {
            $this->restriction($g, 'traits', self::str(self::field($tr, 'id')), self::field($tr, 'idClassPermitted'), self::field($tr, 'idClassProhibited'));
        }
        foreach ($data['characterTemplates'] ?? [] as $ct) {
            $this->collectTemplate($g, $ct);
        }
        return $g;
    }

    private function buildFromDb(int $storyId): array
    {
        $g = $this->newGraph();
        $rp = $this->readPort;
        $locations = $rp->findLocationsForStory($storyId);
        $events = $rp->findEventsForStory($storyId);
        $items = $rp->findItemsForStory($storyId);
        $choices = $rp->findEntitiesByStory($storyId, 'list_choices');
        $classes = $rp->findClassesForStory($storyId);
        $missions = $rp->findEntitiesByStory($storyId, 'list_missions');
        foreach ($locations as $row) {
            $this->addId($g['locations'], self::field($row, 'id'));
        }
        foreach ($events as $row) {
            $this->addId($g['events'], self::field($row, 'id'));
        }
        foreach ($items as $row) {
            $this->addId($g['items'], self::field($row, 'id'));
        }
        foreach ($choices as $row) {
            $this->addId($g['choices'], self::field($row, 'id'));
        }
        foreach ($classes as $row) {
            $this->addId($g['classes'], self::field($row, 'id'));
        }
        foreach ($missions as $row) {
            $this->addId($g['missions'], self::field($row, 'id'));
        }
        foreach ($rp->findEntitiesByStory($storyId, 'list_keys') as $k) {
            $name = self::field($k, 'name');
            if ($name !== null) {
                $g['keyNames'][strtolower(trim((string) $name))] = true;
            }
        }

        foreach ($events as $e) {
            $this->collectEvent($g, $e);
        }
        foreach ($choices as $c) {
            $this->collectChoice($g, $c);
        }
        foreach ($rp->findEntitiesByStory($storyId, 'list_choices_effects') as $ce) {
            $cid = self::asInt(self::field($ce, 'idChoices'));
            if ($cid !== null) {
                $g['choicesWithOption'][$cid] = true;
            }
            $this->ref($g, 'choice-effects', self::str(self::field($ce, 'id')), 'idChoices', self::CHOICE, $cid);
        }
        foreach ($rp->findEntitiesByStory($storyId, 'list_choices_conditions') as $cc) {
            $this->ref($g, 'choice-conditions', self::str(self::field($cc, 'id')), 'idChoices', self::CHOICE, self::asInt(self::field($cc, 'idChoices')));
            $g['keyRefs'][] = [self::str(self::field($cc, 'id')), self::field($cc, 'type'), self::field($cc, 'key')];
        }
        foreach ($rp->findEntitiesByStory($storyId, 'list_events_effects') as $ee) {
            $this->collectEventEffect($g, $ee);
        }
        foreach ($rp->findEntitiesByStory($storyId, 'list_items_effects') as $ie) {
            $this->ref($g, 'item-effects', self::str(self::field($ie, 'id')), 'idItem', self::ITEM, self::asInt(self::field($ie, 'idItem')));
        }
        foreach ($rp->findClassBonusesForStory($storyId) as $cb) {
            $this->ref($g, 'class-bonuses', self::str(self::field($cb, 'id')), 'idClass', self::CLAS, self::asInt(self::field($cb, 'idClass')));
        }
        foreach ($rp->findEntitiesByStory($storyId, 'list_missions_steps') as $ms) {
            $this->ref($g, 'mission-steps', self::str(self::field($ms, 'id')), 'idMission', self::MISSION, self::asInt(self::field($ms, 'idMission')));
        }
        foreach ($rp->findEntitiesByStory($storyId, 'list_weather_rules') as $wr) {
            $this->ref($g, 'weather-rules', self::str(self::field($wr, 'id')), 'idEvent', self::EVENT, self::asInt(self::field($wr, 'idEvent')));
        }
        foreach ($rp->findEntitiesByStory($storyId, 'list_global_random_events') as $gr) {
            $this->ref($g, 'global-random-events', self::str(self::field($gr, 'id')), 'idEvent', self::EVENT, self::asInt(self::field($gr, 'idEvent')));
        }
        foreach ($rp->findEntitiesByStory($storyId, 'list_locations_neighbors') as $n) {
            $this->collectNeighbor($g, $n);
        }
        foreach ($items as $it) {
            $this->restriction($g, 'items', self::str(self::field($it, 'id')), self::field($it, 'idClassPermitted'), self::field($it, 'idClassProhibited'));
        }
        foreach ($rp->findTraitsForStory($storyId) as $tr) {
            $this->restriction($g, 'traits', self::str(self::field($tr, 'id')), self::field($tr, 'idClassPermitted'), self::field($tr, 'idClassProhibited'));
        }
        foreach ($rp->findCharacterTemplatesForStory($storyId) as $ct) {
            $this->collectTemplate($g, $ct, 'idTipo');
        }
        return $g;
    }

    // ----- collectors -----

    private function collectEvent(array &$g, array $e): void
    {
        $eid = self::str(self::field($e, 'id'));
        $this->ref($g, 'events', $eid, 'idSpecificLocation', self::LOCATION, self::asInt(self::field($e, 'idSpecificLocation')));
        $this->ref($g, 'events', $eid, 'idItemToAdd', self::ITEM, self::asInt(self::field($e, 'idItemToAdd')));
        $this->ref($g, 'events', $eid, 'idEventNext', self::EVENT, self::asInt(self::field($e, 'idEventNext')));
        $my = self::asInt(self::field($e, 'id'));
        $nxt = self::asInt(self::field($e, 'idEventNext'));
        if ($my !== null && $nxt !== null) {
            $g['eventNext'][$my] = $nxt;
        }
    }

    private function collectChoice(array &$g, array $c): void
    {
        $cid = self::str(self::field($c, 'id'));
        $this->ref($g, 'choices', $cid, 'idEvent', self::EVENT, self::asInt(self::field($c, 'idEvent')));
        $this->ref($g, 'choices', $cid, 'idLocation', self::LOCATION, self::asInt(self::field($c, 'idLocation')));
        $this->ref($g, 'choices', $cid, 'idEventTorun', self::EVENT, self::asInt(self::field($c, 'idEventTorun')));
        $my = self::asInt(self::field($c, 'id'));
        if ($my !== null) {
            $g['choiceOtherwise'][$my] = self::truthy(self::field($c, 'otherwiseFlag'));
        }
    }

    private function collectEventEffect(array &$g, array $ee): void
    {
        $eid = self::str(self::field($ee, 'id'));
        $this->ref($g, 'event-effects', $eid, 'idEvent', self::EVENT, self::asInt(self::field($ee, 'idEvent')));
        $this->ref($g, 'event-effects', $eid, 'idItemTarget', self::ITEM, self::asInt(self::field($ee, 'idItemTarget')));
        $this->ref($g, 'event-effects', $eid, 'targetClass', self::CLAS, self::asInt(self::field($ee, 'targetClass')));
    }

    private function collectNeighbor(array &$g, array $n): void
    {
        $frm = self::asInt(self::field($n, 'idLocationFrom'));
        $to = self::asInt(self::field($n, 'idLocationTo'));
        $nid = self::str(self::field($n, 'id'));
        $this->ref($g, 'location-neighbors', $nid, 'idLocationFrom', self::LOCATION, $frm);
        $this->ref($g, 'location-neighbors', $nid, 'idLocationTo', self::LOCATION, $to);
        $g['neighbors'][] = [$nid, $frm, $to, self::field($n, 'direction')];
    }

    private function collectTemplate(array &$g, array $ct, string $idKey = 'id'): void
    {
        $eid = self::str(self::field($ct, $idKey) ?? self::field($ct, 'idTipo'));
        $this->restriction($g, 'character-templates', $eid, self::field($ct, 'idClassPermitted'), self::field($ct, 'idClassProhibited'));
        $g['templates'][] = [
            $eid,
            self::asInt(self::field($ct, 'lifeMax')), self::asInt(self::field($ct, 'energyMax')),
            self::asInt(self::field($ct, 'dexterityStart')), self::asInt(self::field($ct, 'intelligenceStart')),
            self::asInt(self::field($ct, 'constitutionStart')), self::asInt(self::field($ct, 'sadMax')),
        ];
    }

    // ----- helpers -----

    private function ref(array &$g, string $etype, ?string $eid, string $field, string $target, ?int $value): void
    {
        if ($value !== null && $value > 0) {
            $g['refs'][] = [self::REF_RULES[$target], $etype, $eid, $field, $target, $value];
        }
    }

    private function restriction(array &$g, string $etype, ?string $eid, $permitted, $prohibited): void
    {
        $p = self::asInt($permitted);
        $q = self::asInt($prohibited);
        $g['restrictions'][] = [$etype, $eid, $p, $q];
        if ($p !== null && $p > 0) {
            $g['refs'][] = ['R6_CLASS_REF', $etype, $eid, 'idClassPermitted', self::CLAS, $p];
        }
        if ($q !== null && $q > 0) {
            $g['refs'][] = ['R6_CLASS_REF', $etype, $eid, 'idClassProhibited', self::CLAS, $q];
        }
    }

    private function collectIds(array &$set, array $items): void
    {
        foreach ($items as $it) {
            $this->addId($set, self::field($it, 'id'));
        }
    }

    private function addId(array &$set, $raw): void
    {
        $v = self::asInt($raw);
        if ($v !== null) {
            $set[$v] = true;
        }
    }

    private static function field(array $row, string $camel)
    {
        if (array_key_exists($camel, $row)) {
            return $row[$camel];
        }
        $snake = strtolower(preg_replace('/([A-Z])/', '_$1', $camel));
        return $row[$snake] ?? null;
    }

    private static function asInt($value): ?int
    {
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }
        if (is_int($value)) {
            return $value;
        }
        if (is_float($value)) {
            return (int) $value;
        }
        if (is_string($value) && is_numeric(trim($value))) {
            return (int) trim($value);
        }
        return null;
    }

    private static function truthy($value): bool
    {
        $i = self::asInt($value);
        if ($i !== null) {
            return $i !== 0;
        }
        return $value === true || strtolower((string) $value) === 'true';
    }

    private static function str($value): ?string
    {
        return $value === null ? null : (string) $value;
    }
}
