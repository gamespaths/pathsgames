<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Story;

use Games\Paths\Core\Port\Story\StoryReadPort;
use Games\Paths\Core\Service\Story\StoryValidatorService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class StoryValidatorServiceTest extends TestCase
{
    private StoryReadPort&MockObject $readPort;
    private StoryValidatorService $validator;

    protected function setUp(): void
    {
        $this->readPort = $this->createMock(StoryReadPort::class);
        $this->validator = new StoryValidatorService($this->readPort);
    }

    private function validStory(): array
    {
        return [
            'uuid' => 'story-valid',
            'idLocationStart' => 1,
            'locations' => [['id' => 1], ['id' => 2]],
            'events' => [['id' => 1], ['id' => 2, 'idEventNext' => 1]],
            'items' => [['id' => 1]],
            'classes' => [['id' => 1]],
            'keys' => [['name' => 'CHAPTER', 'value' => '1']],
            'choices' => [['id' => 1, 'idEvent' => 1, 'otherwiseFlag' => 1]],
            'locationNeighbors' => [['id' => 1, 'idLocationFrom' => 1, 'idLocationTo' => 2, 'direction' => 'N']],
        ];
    }

    /** @return string[] */
    private function rules($report): array
    {
        return array_map(fn ($e) => $e->rule, $report->getErrors());
    }

    public function testValidStoryPasses(): void
    {
        $this->assertTrue($this->validator->validateImportData($this->validStory())->isValid());
    }

    public function testEmptyReported(): void
    {
        $this->assertFalse($this->validator->validateImportData([])->isValid());
    }

    public function testDanglingLocationStart(): void
    {
        $s = $this->validStory();
        $s['idLocationStart'] = 99;
        $this->assertFalse($this->validator->validateImportData($s)->isValid());
    }

    public function testZeroReferenceIsNone(): void
    {
        $s = $this->validStory();
        $s['idLocationAllPlayerComa'] = 0;
        $s['idEventAllPlayerComa'] = -1;
        $this->assertTrue($this->validator->validateImportData($s)->isValid());
    }

    public function testNeighborMissingLocation(): void
    {
        $s = $this->validStory();
        $s['locationNeighbors'] = [['id' => 1, 'idLocationFrom' => 1, 'idLocationTo' => 77, 'direction' => 'N']];
        $this->assertFalse($this->validator->validateImportData($s)->isValid());
    }

    public function testNeighborSelfLoop(): void
    {
        $s = $this->validStory();
        $s['locationNeighbors'] = [['id' => 1, 'idLocationFrom' => 1, 'idLocationTo' => 1, 'direction' => 'N']];
        $this->assertContains('R2_NEIGHBOR_SELF', $this->rules($this->validator->validateImportData($s)));
    }

    public function testNeighborBlankDirection(): void
    {
        $s = $this->validStory();
        $s['locationNeighbors'] = [['id' => 1, 'idLocationFrom' => 1, 'idLocationTo' => 2, 'direction' => '']];
        $this->assertContains('R2_NEIGHBOR_DIR', $this->rules($this->validator->validateImportData($s)));
    }

    public function testNeighborDuplicateDirection(): void
    {
        $s = $this->validStory();
        $s['locationNeighbors'] = [
            ['id' => 1, 'idLocationFrom' => 1, 'idLocationTo' => 2, 'direction' => 'N'],
            ['id' => 2, 'idLocationFrom' => 1, 'idLocationTo' => 1, 'direction' => 'N'],
        ];
        $this->assertContains('R2_NEIGHBOR_DUP', $this->rules($this->validator->validateImportData($s)));
    }

    public function testEventRefersMissingLocation(): void
    {
        $s = $this->validStory();
        $s['events'] = [['id' => 1, 'idSpecificLocation' => 50]];
        $this->assertFalse($this->validator->validateImportData($s)->isValid());
    }

    public function testEventChainCycle(): void
    {
        $s = $this->validStory();
        $s['events'] = [['id' => 1, 'idEventNext' => 2], ['id' => 2, 'idEventNext' => 1]];
        $this->assertContains('R3_EVENT_CYCLE', $this->rules($this->validator->validateImportData($s)));
    }

    public function testEventSelfCycle(): void
    {
        $s = $this->validStory();
        $s['events'] = [['id' => 1, 'idEventNext' => 1]];
        $this->assertContains('R3_EVENT_CYCLE', $this->rules($this->validator->validateImportData($s)));
    }

    public function testLongAcyclicChainPasses(): void
    {
        $s = $this->validStory();
        $s['events'] = [['id' => 1, 'idEventNext' => 2], ['id' => 2, 'idEventNext' => 3], ['id' => 3]];
        $this->assertTrue($this->validator->validateImportData($s)->isValid());
    }

    public function testChoiceWithoutOptionOrOtherwise(): void
    {
        $s = $this->validStory();
        $s['choices'] = [['id' => 1, 'idEvent' => 1, 'otherwiseFlag' => 0]];
        $this->assertContains('R4_CHOICE_EMPTY', $this->rules($this->validator->validateImportData($s)));
    }

    public function testChoiceWithEffectPasses(): void
    {
        $s = $this->validStory();
        $s['choices'] = [['id' => 1, 'idEvent' => 1, 'otherwiseFlag' => 0]];
        $s['choiceEffects'] = [['id' => 1, 'idChoices' => 1]];
        $this->assertTrue($this->validator->validateImportData($s)->isValid());
    }

    public function testChoiceRefersMissingEvent(): void
    {
        $s = $this->validStory();
        $s['choices'] = [['id' => 1, 'idEvent' => 88, 'otherwiseFlag' => 1]];
        $this->assertFalse($this->validator->validateImportData($s)->isValid());
    }

    public function testConditionUnknownKey(): void
    {
        $s = $this->validStory();
        $s['choiceConditions'] = [['id' => 1, 'idChoices' => 1, 'type' => 'KEY', 'key' => 'MISSING']];
        $this->assertContains('R4_CONDITION_KEY', $this->rules($this->validator->validateImportData($s)));
    }

    public function testItemRefersMissingClass(): void
    {
        $s = $this->validStory();
        $s['items'] = [['id' => 1, 'idClassPermitted' => 9]];
        $this->assertFalse($this->validator->validateImportData($s)->isValid());
    }

    public function testTemplateNegativeStat(): void
    {
        $s = $this->validStory();
        $s['characterTemplates'] = [['id' => 1, 'lifeMax' => 10, 'energyMax' => 10, 'dexterityStart' => -3]];
        $this->assertContains('R6_STAT_RANGE', $this->rules($this->validator->validateImportData($s)));
    }

    public function testTemplatePermittedEqualsProhibited(): void
    {
        $s = $this->validStory();
        $s['characterTemplates'] = [['id' => 1, 'lifeMax' => 10, 'energyMax' => 10, 'idClassPermitted' => 1, 'idClassProhibited' => 1]];
        $this->assertContains('R6_CLASS_CONFLICT', $this->rules($this->validator->validateImportData($s)));
    }

    public function testMissionStepMissingMission(): void
    {
        $s = $this->validStory();
        $s['missionSteps'] = [['id' => 1, 'idMission' => 5]];
        $this->assertFalse($this->validator->validateImportData($s)->isValid());
    }

    // entity-local (lenient CRUD)

    public function testForwardClassReferenceAllowed(): void
    {
        $this->assertTrue($this->validator->validateEntity('items', ['id' => 1, 'idClassPermitted' => 999])->isValid());
    }

    public function testBadStatRangeRejected(): void
    {
        $this->assertFalse($this->validator->validateEntity('character-templates', ['id' => 1, 'lifeMax' => -5, 'energyMax' => 10])->isValid());
    }

    public function testClassConflictRejected(): void
    {
        $this->assertFalse($this->validator->validateEntity('traits', ['id' => 1, 'idClassPermitted' => 3, 'idClassProhibited' => 3])->isValid());
    }

    public function testDifficultyRangeRejected(): void
    {
        $this->assertFalse($this->validator->validateEntity('difficulties', ['id' => 1, 'minCharacter' => 4, 'maxCharacter' => 2])->isValid());
    }

    public function testUnknownEntityTypeIsValid(): void
    {
        $this->assertTrue($this->validator->validateEntity('locations', ['id' => 1])->isValid());
    }

    // validate_story via read port (snake_case rows)

    public function testValidateStoryByUuidNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->validator->validateStoryByUuid('ghost'));
    }

    public function testValidateStoryBrokenChoiceEventFromDb(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 7, 'uuid' => 'x']);
        $this->readPort->method('findLocationsForStory')->willReturn([['id' => 1]]);
        $this->readPort->method('findEventsForStory')->willReturn([['id' => 1]]);
        $this->readPort->method('findItemsForStory')->willReturn([]);
        $this->readPort->method('findClassesForStory')->willReturn([]);
        $this->readPort->method('findClassBonusesForStory')->willReturn([]);
        $this->readPort->method('findTraitsForStory')->willReturn([]);
        $this->readPort->method('findCharacterTemplatesForStory')->willReturn([]);
        $this->readPort->method('findEntitiesByStory')->willReturnCallback(function ($sid, $table) {
            if ($table === 'list_choices') {
                return [['id' => 1, 'id_event' => 55, 'otherwise_flag' => 1]];
            }
            return [];
        });

        $report = $this->validator->validateStoryByUuid('x');
        $this->assertNotNull($report);
        $this->assertFalse($report->isValid());
        $fields = array_map(fn ($e) => $e->field, $report->getErrors());
        $this->assertContains('idEvent', $fields);
    }
}
