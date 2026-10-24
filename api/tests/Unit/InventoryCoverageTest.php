<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Splk\Api\Domain\Costumes\InventoryCoverage;

final class InventoryCoverageTest extends TestCase
{
    public function testLaterAbsenceDoesNotErasePhysicalCoverageButPreventsCleanClosure(): void
    {
        $result = InventoryCoverage::evaluate([$this->target()], [$this->check(1, 'presented'), $this->check(2, 'not_presented')]);
        self::assertSame(1, $result['verifiedTargetCount']); self::assertSame(1, $result['verifiedQuantity']);
        self::assertSame(['not_presented'], array_column($result['issues'], 'kind')); self::assertFalse($result['canCloseCleanly']);
    }

    public function testCancelledEvidenceDoesNotCountAndHistoryIsNotMutated(): void
    {
        $positive = $this->check(1, 'found'); $positive['cancelledAt'] = '2026-10-24T12:00:00Z';
        $checks = [$positive, $this->check(2, 'not_found')];
        $result = InventoryCoverage::evaluate([$this->target()], $checks);
        self::assertSame(0, $result['verifiedTargetCount']); self::assertFalse($result['canCloseCleanly']);
        self::assertSame(['unverified', 'not_found'], array_column($result['issues'], 'kind'));
        self::assertCount(2, $checks);
    }

    public function testNewPhysicalObservationResolvesAbsenceAndRepeatedChecksCountOnce(): void
    {
        $result = InventoryCoverage::evaluate([$this->target()], [$this->check(1, 'found'), $this->check(2, 'not_found'), $this->check(3, 'found')]);
        self::assertSame(1, $result['verifiedQuantity']); self::assertSame(1, $result['verifiedTargetCount']);
        self::assertSame([], $result['issues']); self::assertTrue($result['canCloseCleanly']);
    }

    public function testBulkCountsStayOutsidePhysicalCoverageAndShortageStaysExplicit(): void
    {
        $target = array_replace($this->target(), ['itemId' => null, 'bulkStockId' => 4, 'expectedQty' => 2]);
        $first = array_replace($this->check(1, 'found'), ['checkedQty' => 2]);
        $second = array_replace($this->check(2, 'found'), ['checkedQty' => 1]);
        $result = InventoryCoverage::evaluate([$target], [$first, $second]);
        self::assertSame(0, $result['verifiedQuantity']); self::assertSame(0, $result['expectedQuantity']); self::assertSame(0, $result['verifiedTargetCount']);
        self::assertSame(1, $result['bulkTargetCount']); self::assertSame(1, $result['comparedBulkTargetCount']);
        self::assertSame(['quantity_mismatch'], array_column($result['issues'], 'kind')); self::assertFalse($result['canCloseCleanly']);
        $result = InventoryCoverage::evaluate([$target], [array_replace($first, ['checkedQty' => 9])]);
        self::assertSame(0, $result['verifiedQuantity']); self::assertSame(1, $result['openIssueCount']);
    }

    public function testDamageAndOpenWorkOrdersRemainIssuesOnVerifiedPieces(): void
    {
        $result = InventoryCoverage::evaluate([$this->target()], [array_replace($this->check(1, 'presented'), ['condition' => 'damaged'])], [], [['id' => 8, 'itemId' => 2, 'status' => 'open']]);
        self::assertSame(1, $result['verifiedTargetCount']);
        self::assertSame(['damaged', 'open_work_order'], array_column($result['issues'], 'kind')); self::assertFalse($result['canCloseCleanly']);
    }

    public function testExplicitLocationOrCompositionConflictRemainsSeparateFromPhysicalCoverage(): void
    {
        foreach (['confirmedLocationConflict' => 'location_mismatch', 'confirmedCompositionConflict' => 'composition_mismatch'] as $flag => $kind) {
            $result = InventoryCoverage::evaluate([$this->target()], [array_replace($this->check(1, 'found'), ['context' => [$flag => true]])]);
            self::assertSame(1, $result['verifiedQuantity']); self::assertSame([$kind], array_column($result['issues'], 'kind')); self::assertFalse($result['canCloseCleanly']);
        }
    }
    public function testOmittingAConditionPreservesItsLastFindingAndAnOldOkDoesNotHideCurrentDamage(): void
    {
        $damage = array_replace($this->check(1, 'found'), ['condition' => 'damaged']);
        $result = InventoryCoverage::evaluate([array_replace($this->target(), ['currentCondition' => 'ok'])], [$damage, $this->check(2, 'found')]);
        self::assertSame(['damaged'], array_column($result['issues'], 'kind'));
        $ok = array_replace($this->check(2, 'found'), ['condition' => 'ok']);
        self::assertSame([], InventoryCoverage::evaluate([array_replace($this->target(), ['currentCondition' => 'ok'])], [$damage, $ok])['issues']);
        $result = InventoryCoverage::evaluate([array_replace($this->target(), ['currentCondition' => 'damaged'])], [$ok]);
        self::assertSame(['damaged'], array_column($result['issues'], 'kind')); self::assertSame(1, $result['verifiedQuantity']);
        self::assertArrayNotHasKey('checkId', $result['issues'][0]);
    }

    public function testVisitsAndKitContainersDoNotDoubleCountPhysicalComponents(): void
    {
        $kit = array_replace($this->target(), ['id' => 4, 'itemId' => null, 'kitId' => 5]);
        $visits = [['personId' => 3, 'status' => 'completed'], ['personId' => 3, 'status' => 'completed']];
        $result = InventoryCoverage::evaluate([$this->target(), $kit], [array_replace($this->check(1, 'found'), ['targetId' => 4])], $visits);
        self::assertSame(1, $result['expectedQuantity']); self::assertSame(0, $result['verifiedQuantity']);
        self::assertSame(1, $result['verifiedKitCount']); self::assertSame(1, $result['peopleCount']); self::assertSame(1, $result['visitedPeopleCount']);
        self::assertFalse($result['canCloseCleanly']);
    }

    private function target(): array
    {
        return ['id' => 1, 'itemId' => 2, 'kitId' => null, 'bulkStockId' => null, 'expectedQty' => 1, 'holderPersonId' => 3];
    }

    private function check(int $id, string $result): array
    {
        return ['id' => $id, 'targetId' => 1, 'result' => $result, 'checkedQty' => null, 'condition' => null,
            'cancelledAt' => null, 'note' => null, 'at' => '2026-10-24T12:00:00Z'];
    }
}
