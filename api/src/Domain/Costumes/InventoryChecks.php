<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;

/** Physical observations share evidence across modes, but never perform loan operations. */
final class InventoryChecks
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function validate(array $body): array
    {
        InventoryInput::only($body, ['version', 'mode', 'personId', 'holderUnitId', 'kitId', 'entries']);
        $input = new Input($body); $input->id('version');
        $mode = $input->enum('mode', ['people', 'store', 'kit']);
        $person = $input->nullableId('personId'); $holderUnit = $input->nullableId('holderUnitId'); $kit = $input->nullableId('kitId');
        $holders = (int) ($person !== null) + (int) ($holderUnit !== null);
        if (($mode === 'people' ? $holders !== 1 : $holders !== 0) || ($mode === 'kit') !== ($kit !== null)) throw Input::invalid('mode', 'invalid');
        $entries = $body['entries'] ?? null;
        if (!is_array($entries) || !array_is_list($entries) || count($entries) < 1 || count($entries) > 200) throw Input::invalid('entries', 'invalid');
        $normalized = [];
        foreach ($entries as $entry) {
            if (!is_array($entry)) throw Input::invalid('entries', 'invalid');
            InventoryInput::only($entry, ['targetId', 'seriesId', 'number', 'result', 'condition', 'checkedQty', 'note', 'recheck', 'confirmConflict']);
            $e = new Input($entry); $target = $e->nullableId('targetId');
            if ($target !== null && ($e->has('seriesId') || $e->has('number'))) throw Input::invalid('targetId', 'invalid');
            $series = $target === null ? $e->id('seriesId') : null;
            $number = $target === null ? $e->text('number', 100) : null;
            $result = $e->enum('result', $mode === 'people' ? ['presented', 'not_presented'] : ['found', 'not_found']);
            $condition = $e->enum('condition', ['ok', 'damaged', 'needs_adjustment'], true);
            $qty = $e->has('checkedQty') ? InventoryInput::quantity($entry, 'checkedQty') : null;
            $positive = in_array($result, ['presented', 'found'], true);
            if (!$positive && $condition !== null) throw Input::invalid('condition', 'not_allowed');
            $normalized[] = ['targetId' => $target, 'seriesId' => $series, 'number' => $number, 'result' => $result,
                'condition' => $condition, 'checkedQty' => $qty, 'note' => $e->optionalString('note', 2000),
                'recheck' => $e->bool('recheck', false), 'confirmConflict' => $e->bool('confirmConflict', false)];
        }
        return ['mode' => $mode, 'personId' => $person, 'holderUnitId' => $holderUnit, 'kitId' => $kit, 'entries' => $normalized];
    }

    /** Called inside the audited transaction after locking and checking the inventory version. */
    public function record(array $inventory, array $batch, int $actor): array
    {
        $repository = new InventoryRepository($this->db); $items = new ItemRepository($this->db); $loans = new LoanRepository($this->db);
        // Freeze also serializes current loan/composition metadata for conflict responses and bulk comparison.
        $currentTargets = (new InventoryScope($this->db))->freeze($inventory['unitId'], []);
        if ($batch['kitId'] !== null) {
            $kit = (new KitRepository($this->db))->find($batch['kitId']);
            if ($kit === null || $kit['unitId'] !== $inventory['unitId']) throw new \Splk\Api\Http\HttpException(404, 'not_found', 'Not found.');
        }
        $targets = $repository->targets($inventory['id']); $history = $repository->checks($inventory['id']); $results = [];
        foreach ($batch['entries'] as $entry) {
            $targetId = $entry['targetId'];
            if ($targetId === null) {
                $query = $this->db->prepare('SELECT t.id FROM inventory_targets t JOIN costume_items i ON i.id = t.item_id
                    WHERE t.inventory_id = :inventory AND i.unit_id = :unit AND i.series_id = :series AND i.number = :number AND i.retired_at IS NULL');
                $query->execute(['inventory' => $inventory['id'], 'unit' => $inventory['unitId'], 'series' => $entry['seriesId'], 'number' => $entry['number']]);
                $found = $query->fetchColumn(); $targetId = $found === false ? null : (int) $found;
            }
            $target = null;
            foreach ($targets as $candidate) {
                if ($candidate['id'] === $targetId) {
                    $target = $candidate; break;
                }
            }
            if ($target === null) { $results[] = ['code' => 'unknown_number', 'targetId' => null]; continue; }
            $positive = in_array($entry['result'], ['presented', 'found'], true);
            if ($target['bulkStockId'] !== null && $entry['checkedQty'] === null) throw Input::invalid('checkedQty', 'required');
            if ($target['bulkStockId'] === null && $entry['checkedQty'] !== null) throw Input::invalid('checkedQty', 'not_allowed');
            if ($target['itemId'] === null && $entry['condition'] !== null) throw Input::invalid('condition', 'not_allowed');
            if ($batch['mode'] === 'people' && ($target['holderPersonId'] !== $batch['personId'] || $target['holderUnitId'] !== $batch['holderUnitId'])) throw Input::invalid('holder', 'invalid');
            $item = $target['itemId'] === null ? null : $items->find($target['itemId']);
            $loan = $item === null ? ($target['kitId'] === null ? null : $loans->currentKitLoan($target['kitId'])) : $loans->openItem($item['id']);
            if ($target['loanLineId'] !== null && $target['bulkStockId'] !== null) {
                $query = $this->db->prepare('SELECT l.* FROM costume_loan_lines ll JOIN costume_loans l ON l.id = ll.loan_id WHERE ll.id = :id AND ll.closed_at IS NULL');
                $query->execute(['id' => $target['loanLineId']]); $row = $query->fetch();
                if ($row !== false) $loan = ['loanId' => (int) $row['id'], 'kitId' => $row['kit_id'] === null ? null : (int) $row['kit_id'],
                    'holder' => $row['holder_person_id'] === null ? ['unitId' => (int) $row['holder_unit_id']] : ['personId' => (int) $row['holder_person_id']]];
            }
            $compositionConflict = false;
            if ($batch['mode'] === 'kit') {
                $belongs = $target['kitId'] === $batch['kitId'] || $target['contextKitId'] === $batch['kitId'] || ($item !== null && $item['kitId'] === $batch['kitId']);
                if (!$belongs) {
                    if ($item === null || !$positive) throw Input::invalid('kitId', 'invalid');
                    if (!$entry['confirmConflict'] || $entry['note'] === null) {
                        $results[] = ['code' => 'not_in_kit', 'targetId' => $target['id'], 'context' => ['kitId' => $batch['kitId'], 'intendedKitId' => $item['kitId']]]; continue;
                    }
                    $compositionConflict = true;
                }
            }
            $context = ['personId' => $batch['personId'], 'holderUnitId' => $batch['holderUnitId'], 'kitId' => $batch['kitId'], 'holder' => $loan['holder'] ?? null,
                'loanId' => $loan['loanId'] ?? null, 'location' => $item['location'] ?? null];
            if ($compositionConflict) $context += ['confirmedCompositionConflict' => true, 'intendedKitId' => $item['kitId']];
            if ($target['bulkStockId'] !== null) {
                $context['expectedQty'] = 0;
                foreach ($currentTargets as $current) if ($current['bulkStockId'] === $target['bulkStockId'] && $current['contextKitId'] === $target['contextKitId'] && $current['loanLineId'] === $target['loanLineId']) $context['expectedQty'] = $current['expectedQty'];
            }
            $code = null;
            if ($positive && $item !== null && $item['retiredAt'] !== null) $code = 'item_retired';
            if ($positive && $loan !== null) {
                $matches = match ($batch['mode']) {
                    'people' => $batch['personId'] !== null ? ($loan['holder']['personId'] ?? null) === $batch['personId'] : ($loan['holder']['unitId'] ?? null) === $batch['holderUnitId'],
                    'kit' => ($loan['kitId'] ?? ($target['kitId'] !== null ? $target['kitId'] : null)) === $batch['kitId'],
                    default => false,
                };
                if (!$matches) $code = 'loaned_to';
            }
            if ($positive && $batch['mode'] === 'store' && $item !== null && $item['location'] !== 'store' && $code === null) {
                if (!$entry['confirmConflict'] || $entry['note'] === null) $code = 'not_in_store';
                else $context['confirmedLocationConflict'] = true;
            }
            if ($positive && $batch['mode'] === 'store' && $target['bulkStockId'] !== null && ($target['contextKitId'] !== null || $target['loanLineId'] !== null)) $code = 'not_in_store';
            if ($code !== null) { $results[] = ['code' => $code, 'targetId' => $target['id'], 'context' => $context]; continue; }
            if ($positive && !$entry['recheck'] && $target['bulkStockId'] === null && array_any($history, static fn (array $c): bool => $c['targetId'] === $target['id'] && $c['cancelledAt'] === null && in_array($c['result'], ['presented', 'found'], true))) {
                $results[] = ['code' => 'already_checked', 'targetId' => $target['id']]; continue;
            }
            $id = $repository->addCheck($inventory['unitId'], $inventory['id'], $target['id'], $batch['mode'], $entry['result'], $entry['condition'], $entry['checkedQty'], $entry['note'], $actor, $context);
            $check = $repository->check($id); $history[] = $check;
            if ($item !== null) $items->record($item['id'], $actor, 'inventory_checked', $check);
            $results[] = ['code' => 'ok', 'targetId' => $target['id'], 'check' => $check];
        }
        if (array_any($results, static fn (array $r): bool => $r['code'] === 'ok')) $repository->touch($inventory['id']);
        return ['id' => $inventory['id'], 'inventory' => $repository->find($inventory['id']) + ['progress' => $repository->progress($repository->find($inventory['id']))], 'results' => $results];
    }
}
