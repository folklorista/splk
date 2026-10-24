<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\BulkStockRepository;
use Splk\Api\Domain\Costumes\ItemRepository;
use Splk\Api\Domain\Costumes\KitRepository;
use Splk\Api\Domain\Costumes\LoanRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;

final class LoanController extends Controller
{
    public function register(Router $router): void
    {
        $router->add('GET', '/v1/funds/{unitId}/loans', $this->list(...));
        $router->add('GET', '/v1/funds/{unitId}/movements', $this->movements(...));
        $router->add('POST', '/v1/funds/{unitId}/loans', $this->create(...));
        $router->add('GET', '/v1/loans/{id}', $this->detail(...));
        $router->add('PATCH', '/v1/loans/{id}', $this->update(...));
        $router->add('POST', '/v1/loans/{id}/return', $this->return(...));
        $router->add('POST', '/v1/loans/{id}/exchange', $this->exchange(...));
    }

    private function list(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], false);
        InventoryInput::only($request->query, ['limit', 'offset', 'open', 'overdue', 'holderType', 'person', 'kit']);
        $filters = [];
        foreach (['open', 'overdue'] as $field) {
            if (isset($request->query[$field])) {
                $filters[$field] = match ($request->query[$field]) { 'true' => true, 'false' => false, default => throw Input::invalid($field, 'invalid') };
            }
        }
        if (isset($request->query['person'])) {
            $filters['person'] = InventoryInput::queryInteger($request->query['person'], 'person');
        }
        if (isset($request->query['kit'])) {
            $filters['kit'] = InventoryInput::queryInteger($request->query['kit'], 'kit');
        }
        if (isset($request->query['holderType'])) {
            if ($request->query['holderType'] !== 'external') {
                throw Input::invalid('holderType', 'invalid');
            }
            $filters['holderType'] = 'external';
        }
        [$limit, $offset] = InventoryInput::pagination($request->query);
        return Response::json($this->loans()->list($unit, $filters, $limit, $offset));
    }

    private function movements(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], false);
        InventoryInput::only($request->query, ['limit', 'offset', 'person', 'item', 'kit', 'from', 'to']);
        $filters = [];
        foreach (['person', 'item', 'kit'] as $field) {
            if (isset($request->query[$field])) {
                $filters[$field] = InventoryInput::queryInteger($request->query[$field], $field);
            }
        }
        foreach (['from', 'to'] as $field) {
            if (isset($request->query[$field])) {
                $filters[$field] = self::timestamp($request->query, $field);
            }
        }
        if (isset($filters['from'], $filters['to']) && strtotime($filters['from']) > strtotime($filters['to'])) {
            throw Input::invalid('to', 'invalid');
        }
        [$limit, $offset] = InventoryInput::pagination($request->query);
        return Response::json($this->loans()->movements($unit, $filters, $limit, $offset));
    }

    private function detail(Request $request, RequestContext $context): Response
    {
        return Response::json($this->accessible($context, false));
    }

    private function create(Request $request, RequestContext $context): Response
    {
        $unit = $this->fund($context, $context->params['unitId'], true);
        $body = $request->json();
        InventoryInput::only($body, ['holder', 'items', 'bulk', 'kitId', 'kitVersion', 'kitBulk', 'omitItemIds', 'dueAt', 'note']);
        $holder = $body['holder'] ?? null;
        if (!is_array($holder) || count($holder) !== 1 || (!isset($holder['personId']) && !isset($holder['unitId']))) {
            throw Input::invalid('holder', 'invalid');
        }
        $field = isset($holder['personId']) ? 'personId' : 'unitId';
        $holder = [$field => (new Input($holder))->id($field)];
        $kitId = (new Input($body))->nullableId('kitId');
        if ($kitId !== null && (isset($body['items']) || isset($body['bulk']))) {
            throw Input::invalid('kitId', 'invalid');
        }
        if ($kitId === null && array_intersect(['omitItemIds', 'kitVersion', 'kitBulk'], array_keys($body)) !== []) {
            throw Input::invalid('omitItemIds', 'not_allowed');
        }
        $ids = self::ids($body['items'] ?? [], 'items');
        $omit = self::ids($body['omitItemIds'] ?? [], 'omitItemIds');
        $bulk = self::bulk($body['bulk'] ?? []);
        $kitVersion = array_key_exists('kitVersion', $body) ? (new Input($body))->id('kitVersion') : null;
        $kitBulk = array_key_exists('kitBulk', $body) ? self::bulk($body['kitBulk'], 0) : null;
        $due = self::timestamp($body, 'dueAt');
        $note = (new Input($body))->optionalString('note', 5000);
        return Response::json($this->audited($context, 'loan.issue', $unit, function () use ($unit, $holder, $kitId, $ids, $omit, $bulk, $due, $note, $kitVersion, $kitBulk, $context): array {
            $this->validateHolder($unit, $holder);
            return $this->issue($unit, $holder, $kitId, $ids, $omit, $bulk, $due, $note, self::actor($context), null, $kitVersion, $kitBulk);
        }, 'item_unavailable'), 201);
    }

    private function issue(int $unit, array $holder, ?int $kitId, array $ids, array $omit, array $bulk, ?string $due, ?string $note, int $actor, ?int $replaces = null, ?int $kitVersion = null, ?array $kitBulk = null): array
    {
        $kit = null;
        $missingBulk = false;
        if ($kitId !== null) {
            $kits = new KitRepository($this->db());
            $kit = $kits->find($kitId, true);
            if ($kit === null || $kit['unitId'] !== $unit) {
                throw self::notFound();
            }
            if ($kit['retiredAt'] !== null || $this->loans()->openKit($kitId)) {
                throw new HttpException(422, 'kit_unavailable', 'The kit is retired or still on loan.');
            }
            if ($kitVersion !== null) {
                InventoryInput::version($kit, $kitVersion);
            }
            $detail = $kits->detail($kitId);
            $ids = array_column($detail['items'], 'id');
            $missingBulk = array_any($detail['bulkLines'], static fn (array $line): bool => $line['presentQty'] < $line['requiredQty']);
            if (array_diff($omit, $ids) !== []) {
                throw Input::invalid('omitItemIds', 'invalid');
            }
            $bulk = array_map(static fn (array $line): array => ['stockId' => $line['bulkStockId'], 'qty' => $line['presentQty']],
                array_values(array_filter($detail['bulkLines'], static fn (array $line): bool => $line['presentQty'] > 0)));
        }
        if ($kitBulk !== null) {
            $present = array_column($bulk, 'qty', 'stockId');
            foreach ($kitBulk as $line) {
                if (!array_key_exists($line['stockId'], $present) || $line['qty'] > $present[$line['stockId']]) {
                    throw Input::invalid('kitBulk', 'invalid');
                }
            }
            $missingBulk = $missingBulk || array_sum(array_column($kitBulk, 'qty')) < array_sum($present);
            $bulk = array_values(array_filter($kitBulk, static fn (array $line): bool => $line['qty'] > 0));
        }
        sort($ids, SORT_NUMERIC);
        $omitted = [];
        $actual = [];
        $items = new ItemRepository($this->db());
        foreach ($ids as $id) {
            $item = $items->find($id, true);
            if ($item === null || $item['unitId'] !== $unit) {
                throw self::notFound();
            }
            if (in_array($id, $omit, true) || $item['retiredAt'] !== null || !$item['issuable'] || $this->loans()->openItem($id) !== null) {
                if ($kitId === null) {
                    throw new HttpException(422, 'item_unavailable', 'The item is retired, not issuable, or already on loan.');
                }
                $omitted[] = $id;
            } else {
                $actual[] = $id;
            }
        }
        // Incomplete handovers need an explicit note; copying a label is not a physical check.
        if ($kit !== null && ($omitted !== [] || $missingBulk || $kit['compositionState'] === 'incomplete') && $note === null) {
            throw Input::invalid('note', 'required');
        }
        usort($bulk, static fn (array $a, array $b): int => $a['stockId'] <=> $b['stockId']);
        $stocks = new BulkStockRepository($this->db());
        foreach ($bulk as $line) {
            $stock = $stocks->find($line['stockId'], true);
            if ($stock === null || $stock['unitId'] !== $unit) {
                throw self::notFound();
            }
            if ($kitId === null && $line['qty'] > $stock['quantityAvailable']) {
                throw new HttpException(422, 'insufficient_stock', 'Not enough unallocated stock.');
            }
        }
        if ($actual === [] && $bulk === []) {
            throw Input::invalid('items', 'required');
        }
        $id = $this->loans()->insert($unit, $holder, $kitId, $due, $note, $actor, $replaces);
        foreach ($actual as $itemId) {
            $this->loans()->addLine($unit, $id, $itemId, null, 1);
            $items->record($itemId, $actor, 'issued', ['loanId' => $id, 'holder' => $holder]);
        }
        foreach ($bulk as $line) {
            $this->loans()->addLine($unit, $id, null, $line['stockId'], $line['qty']);
        }
        return $this->loans()->find($id) + ['omittedItemIds' => $omitted];
    }

    private function return(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true);
        InventoryInput::only($request->json(), ['lines']);
        $lines = $request->json()['lines'] ?? null;
        if (!is_array($lines) || !array_is_list($lines) || $lines === [] || count($lines) > 200) {
            throw Input::invalid('lines', 'invalid');
        }
        return Response::json($this->audited($context, 'loan.return', $initial['unitId'], function () use ($initial, $lines, $context): array {
            $loan = $this->loans()->find($initial['id'], true);
            if ($loan['kitId'] !== null) {
                (new KitRepository($this->db()))->find($loan['kitId'], true);
            }
            $seen = [];
            $validated = [];
            foreach ($lines as $values) {
                if (!is_array($values)) {
                    throw Input::invalid('lines', 'invalid');
                }
                InventoryInput::only($values, ['lineId', 'returnedQty', 'closeType', 'note', 'condition', 'issuable', 'location']);
                $input = new Input($values);
                $id = $input->id('lineId');
                if (isset($seen[$id])) {
                    throw Input::invalid('lineId', 'invalid');
                }
                $seen[$id] = true;
                $line = $this->line($loan, $id);
                // A loss closes responsibility without claiming a physical return (D-62).
                $type = $input->enum('closeType', ['returned', 'settled']);
                $qty = InventoryInput::quantity($values, 'returnedQty', $type === 'settled' ? 0 : 1);
                if ($type === 'settled' && ($qty >= $line['qty'] - $line['returnedQty'] || $input->optionalString('note', 5000) === null)) {
                    throw Input::invalid('note', 'required');
                }
                if ($line['closedAt'] !== null || $qty > $line['qty'] - $line['returnedQty']) {
                    throw new HttpException(422, 'loan_line_closed', 'The line is closed or the quantity exceeds the outstanding handover.');
                }
                $validated[] = [$line, $qty, $values];
            }
            // Lock pieces and stocks in stable order before applying any return.
            $this->lockReturnItems(array_column($validated, 0));
            foreach ($validated as [$line, $qty, $values]) {
                $this->receive($loan, $line, $qty, $values['closeType'], $values, self::actor($context));
            }
            return $this->loans()->find($loan['id']);
        }));
    }

    private function receive(array $loan, array $line, int $qty, string $type, array $values, int $actor): void
    {
        $input = new Input($values);
        $note = $input->optionalString('note', 5000);
        $updates = [];
        foreach (['condition' => ['ok', 'needs_adjustment', 'damaged'], 'location' => ['store', 'holder', 'seamstress', 'repair', 'unknown']] as $field => $allowed) {
            if ($input->has($field)) {
                $updates[$field] = $input->enum($field, $allowed);
            }
        }
        if ($input->has('issuable')) {
            $updates['issuable'] = $input->bool('issuable');
        }
        if ($type === 'settled' && $line['itemId'] !== null && $updates !== []) {
            throw Input::invalid('condition', 'not_allowed');
        }
        if ($line['itemId'] === null && $updates !== []) {
            throw Input::invalid('condition', 'not_allowed');
        }
        $this->loans()->returnLine($loan['unitId'], $line, $qty, $type, $note, $actor);
        if ($type === 'settled') {
            $this->lose($loan, $line, $qty, $note, $actor);
        }
        if ($line['itemId'] !== null) {
            $items = new ItemRepository($this->db());
            $item = $items->find($line['itemId'], true);
            if ($updates !== []) {
                $items->update($item['id'], array_replace($item, $updates));
                foreach ($updates as $field => $value) {
                    if ($item[$field] !== $value) {
                        $items->record($item['id'], $actor, $field . '_changed', ['from' => $item[$field], 'to' => $value, 'loanId' => $loan['id']]);
                    }
                }
            }
            $items->record($item['id'], $actor, $type, ['loanId' => $loan['id'], 'note' => $note]);
        }
    }

    private function lose(array $loan, array $line, int $returned, string $reason, int $actor): void
    {
        $lost = $line['qty'] - $line['returnedQty'] - $returned;
        if ($line['itemId'] !== null) {
            $items = new ItemRepository($this->db());
            $item = $items->find($line['itemId'], true);
            if ($item['retiredAt'] === null) {
                $items->retire($item['id'], $actor, $reason);
                $items->record($item['id'], $actor, 'retired', ['reason' => $reason, 'loanId' => $loan['id']]);
            }
        } else {
            $stocks = new BulkStockRepository($this->db());
            $stock = $stocks->find($line['bulkStockId'], true);
            if ($loan['kitId'] !== null) {
                $kits = new KitRepository($this->db());
                $allocation = $kits->bulkLine($loan['kitId'], $stock['id']);
                if ($allocation !== null) {
                    $removed = min($lost, $allocation['presentQty']);
                    $kits->setBulkLine($loan['unitId'], $loan['kitId'], $stock['id'], $allocation['requiredQty'], $allocation['presentQty'] - $removed);
                    if ($removed > 0) {
                        $kits->record($loan['unitId'], $loan['kitId'], null, $stock['id'], 'removed', $removed, $actor, $reason);
                    }
                }
            }
            if ($lost > $stock['quantityTotal']) {
                throw new HttpException(422, 'insufficient_stock', 'Loss exceeds the recorded stock.');
            }
            $stocks->update($stock['id'], ['variant' => $stock['variant'], 'quantityTotal' => $stock['quantityTotal'] - $lost, 'note' => $stock['note']]);
        }
        if ($loan['kitId'] !== null) {
            (new KitRepository($this->db()))->touchComposition($loan['kitId']);
        }
    }

    private function exchange(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true);
        $values = $request->json();
        InventoryInput::only($values, ['lineId', 'itemId', 'note', 'condition', 'issuable', 'location']);
        $input = new Input($values);
        $lineId = $input->id('lineId');
        $newId = $input->id('itemId');
        return Response::json($this->audited($context, 'loan.exchange', $initial['unitId'], function () use ($initial, $lineId, $newId, $values, $context): array {
            $loan = $this->loans()->find($initial['id'], true);
            $line = $this->line($loan, $lineId);
            if ($line['itemId'] === null || $line['closedAt'] !== null || $line['itemId'] === $newId) {
                throw Input::invalid('lineId', 'invalid');
            }
            $this->lockReturnItems([$line, ['itemId' => $newId, 'bulkStockId' => null]]);
            $this->receive($loan, $line, 1, 'exchanged', $values, self::actor($context));
            return $this->issue($loan['unitId'], $loan['holder'], null, [$newId], [], [], $loan['dueAt'],
                (new Input($values))->optionalString('note', 5000), self::actor($context), $loan['id']);
        }, 'item_unavailable'), 201);
    }

    private function update(Request $request, RequestContext $context): Response
    {
        $initial = $this->accessible($context, true);
        $values = $request->json();
        InventoryInput::only($values, ['dueAt', 'note']);
        return Response::json($this->audited($context, 'loan.update', $initial['unitId'], function () use ($initial, $values): array {
            $loan = $this->loans()->find($initial['id'], true);
            $this->loans()->update($loan['id'], array_key_exists('dueAt', $values) ? self::timestamp($values, 'dueAt') : $loan['dueAt'],
                array_key_exists('note', $values) ? (new Input($values))->optionalString('note', 5000) : $loan['note']);
            return $this->loans()->find($loan['id']);
        }));
    }

    private function lockReturnItems(array $lines): void
    {
        $items = array_values(array_unique(array_filter(array_column($lines, 'itemId'))));
        sort($items, SORT_NUMERIC);
        foreach ($items as $id) {
            (new ItemRepository($this->db()))->find($id, true);
        }
        $stocks = array_values(array_unique(array_filter(array_column($lines, 'bulkStockId'))));
        sort($stocks, SORT_NUMERIC);
        foreach ($stocks as $id) {
            (new BulkStockRepository($this->db()))->find($id, true);
        }
    }

    private function validateHolder(int $unit, array $holder): void
    {
        $person = isset($holder['personId']);
        $query = $this->db()->prepare($person ? 'SELECT id FROM persons WHERE id = :id FOR SHARE' : 'SELECT id FROM units WHERE id = :id AND archived_at IS NULL FOR SHARE');
        $query->execute(['id' => $holder[$person ? 'personId' : 'unitId']]);
        if ($query->fetchColumn() === false || (!$person && $holder['unitId'] === $unit)) {
            throw Input::invalid('holder', 'invalid');
        }
    }

    private function accessible(RequestContext $context, bool $write): array
    {
        $loan = $this->loans()->find(self::routeId($context)) ?? throw self::notFound();
        $this->fund($context, (string) $loan['unitId'], $write);
        return $loan;
    }

    private function line(array $loan, int $id): array
    {
        foreach ($loan['lines'] as $line) {
            if ($line['id'] === $id) {
                return $line;
            }
        }
        throw self::notFound();
    }

    private static function ids(mixed $values, string $field): array
    {
        if (!is_array($values) || !array_is_list($values) || count($values) > 200) {
            throw Input::invalid($field, 'invalid');
        }
        foreach ($values as $id) {
            if (!is_int($id) || $id < 1) {
                throw Input::invalid($field, 'invalid');
            }
        }
        if (count(array_unique($values)) !== count($values)) {
            throw Input::invalid($field, 'invalid');
        }
        return $values;
    }

    private static function bulk(mixed $values, int $minimum = 1): array
    {
        if (!is_array($values) || !array_is_list($values) || count($values) > 200) {
            throw Input::invalid('bulk', 'invalid');
        }
        $seen = [];
        foreach ($values as $line) {
            if (!is_array($line)) {
                throw Input::invalid('bulk', 'invalid');
            }
            InventoryInput::only($line, ['stockId', 'qty']);
            $id = (new Input($line))->id('stockId');
            InventoryInput::quantity($line, 'qty', $minimum);
            if (isset($seen[$id])) {
                throw Input::invalid('stockId', 'invalid');
            }
            $seen[$id] = true;
        }
        return $values;
    }

    private static function timestamp(array $values, string $field): ?string
    {
        $value = $values[$field] ?? null;
        if ($value === null) {
            return null;
        }
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/D', $value)) {
            throw Input::invalid($field, 'invalid');
        }
        try {
            $date = new \DateTimeImmutable($value);
            $errors = \DateTimeImmutable::getLastErrors();
            if ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) {
                throw Input::invalid($field, 'invalid');
            }
            return $date->format('Y-m-d\TH:i:sP');
        } catch (\DateMalformedStringException) {
            throw Input::invalid($field, 'invalid');
        }
    }

    private function loans(): LoanRepository
    {
        return new LoanRepository($this->db());
    }

    private function fund(RequestContext $context, string $unit, bool $write): int
    {
        return (new FundAccess($this->db()))->require($this->mandates($context), $unit, $write);
    }
}
