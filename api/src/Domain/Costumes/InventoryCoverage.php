<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

/** Coverage and current discrepancies are separate facts (D-63, docs/06 chap. 7.4). */
final class InventoryCoverage
{
    public static function evaluate(array $targets, array $checks, array $visits = [], array $workOrders = []): array
    {
        $active = array_filter($checks, static fn (array $c): bool => $c['cancelledAt'] === null);
        usort($active, static fn (array $a, array $b): int => (new \DateTimeImmutable($a['at'])) <=> (new \DateTimeImmutable($b['at'])) ?: $a['id'] <=> $b['id']);
        $byTarget = [];
        foreach ($active as $check) $byTarget[$check['targetId']][] = $check;
        $issues = [];
        $verifiedTargets = 0; $expectedQuantity = 0; $verifiedQuantity = 0;
        $kitCount = 0; $verifiedKits = 0; $holders = []; $bulkTargets = 0; $bulkCompared = 0; $coverageTargets = 0;
        foreach ($targets as $target) {
            $id = $target['id']; $expected = $target['expectedQty'];
            $observations = $byTarget[$id] ?? [];
            $positive = array_values(array_filter($observations, static fn (array $c): bool => self::physical($c) && ($target['bulkStockId'] === null || $c['checkedQty'] !== null)));
            $maxObserved = $positive === [] ? null : max(array_map(static fn (array $c): int => $c['checkedQty'] ?? 1, $positive));
            $verified = $maxObserved !== null && $maxObserved >= $expected;
            $bulk = $target['bulkStockId'] !== null;
            if (!$bulk) { $coverageTargets++; $verifiedTargets += (int) $verified; }
            if ($target['kitId'] !== null) { $kitCount++; $verifiedKits += (int) $verified; }
            elseif (!$bulk) { $expectedQuantity += $expected; $verifiedQuantity += min($expected, $maxObserved ?? 0); }
            if ($target['holderPersonId'] !== null) $holders[$target['holderPersonId']] = true;
            $add = static function (string $kind, array $data = []) use (&$issues, $id): void {
                $issues[] = ['targetId' => $id, 'kind' => $kind] + $data;
            };
            if (!$bulk && !$verified) $add('unverified', ['expectedQty' => $expected, 'verifiedQty' => min($expected, $maxObserved ?? 0)]);
            $latest = $observations === [] ? null : $observations[array_key_last($observations)];
            if ($bulk) {
                $bulkTargets++;
                if ($latest !== null && $latest['checkedQty'] !== null) $bulkCompared++; else $add('bulk_not_counted');
            }
            if ($latest !== null && !self::physical($latest)) {
                $add($latest['result'], ['checkId' => $latest['id'], 'note' => $latest['note']]);
            }
            $comparedQuantity = $latest === null ? $expected : ((array) ($latest['context'] ?? []))['expectedQty'] ?? $expected;
            if ($latest !== null && self::physical($latest) && $target['bulkStockId'] !== null && $latest['checkedQty'] !== $comparedQuantity) {
                $add('quantity_mismatch', ['checkId' => $latest['id'], 'expectedQty' => $comparedQuantity, 'checkedQty' => $latest['checkedQty']]);
            }
            $lastPhysical = $positive === [] ? null : $positive[array_key_last($positive)];
            $physicalContext = (array) ($lastPhysical['context'] ?? []);
            if ($lastPhysical !== null && ($physicalContext['confirmedCompositionConflict'] ?? false)) $add('composition_mismatch', ['checkId' => $lastPhysical['id']]);
            if ($lastPhysical !== null && ($physicalContext['confirmedLocationConflict'] ?? false)) $add('location_mismatch', ['checkId' => $lastPhysical['id']]);
            $conditionEvidence = array_values(array_filter($positive, static fn (array $c): bool => $c['condition'] !== null));
            $conditionCheck = $conditionEvidence === [] ? null : $conditionEvidence[array_key_last($conditionEvidence)];
            $conditions = array_unique([$conditionCheck['condition'] ?? null, $target['currentCondition'] ?? $target['snapshot']['condition'] ?? null]);
            foreach ($conditions as $condition) if ($lastPhysical !== null && in_array($condition, ['damaged', 'needs_adjustment'], true)) {
                $add($condition, $conditionCheck !== null && $conditionCheck['condition'] === $condition ? ['checkId' => $conditionCheck['id']] : []);
            }
            foreach ($workOrders as $order) {
                if ($target['itemId'] !== null && $order['itemId'] === $target['itemId'] && in_array($order['status'], ['open', 'in_progress'], true)) {
                    $add('open_work_order', ['workOrderId' => $order['id']]);
                }
            }
        }
        $visited = [];
        foreach ($visits as $visit) if ($visit['status'] === 'completed' && isset($holders[$visit['personId']])) $visited[$visit['personId']] = true;
        return ['allTargetCount' => count($targets), 'targetCount' => $coverageTargets, 'verifiedTargetCount' => $verifiedTargets,
            'expectedQuantity' => $expectedQuantity, 'verifiedQuantity' => $verifiedQuantity,
            'kitCount' => $kitCount, 'verifiedKitCount' => $verifiedKits,
            'bulkTargetCount' => $bulkTargets, 'comparedBulkTargetCount' => $bulkCompared,
            'peopleCount' => count($holders), 'visitedPeopleCount' => count($visited),
            'openIssueCount' => count($issues), 'canCloseCleanly' => $verifiedTargets === $coverageTargets && $issues === [], 'issues' => $issues];
    }

    private static function physical(array $check): bool
    {
        return in_array($check['result'], ['presented', 'found'], true);
    }
}
