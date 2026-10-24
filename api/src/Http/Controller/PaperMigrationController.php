<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\ItemRepository;
use Splk\Api\Domain\Costumes\LoanRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\InventoryInput;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;
use Splk\Api\Infrastructure\Audit\AuditLog;

/** D-67: import current custody, never an invented physical handover or verification. */
final class PaperMigrationController extends Controller
{
    public function register(Router $router): void
    {
        $router->add('POST', '/v1/funds/{unitId}/people/{id}/paper-migrations', $this->record(...));
        $router->add('GET', '/v1/funds/{unitId}/people/{id}/paper-migration-findings', $this->findings(...));
    }

    private function record(Request $request, RequestContext $context): Response
    {
        [$unit, $person] = $this->access($context, true);
        $body = $request->json(); InventoryInput::only($body, ['entries', 'note', 'sourceAttachmentId']);
        $note = (new Input($body))->optionalString('note', 2000); $source = (new Input($body))->optionalString('sourceAttachmentId', 36);
        if ($source !== null && !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D', $source)) throw Input::invalid('sourceAttachmentId', 'invalid');
        $entries = $body['entries'] ?? null;
        if (!is_array($entries) || !array_is_list($entries) || count($entries) < 1 || count($entries) > 200) throw Input::invalid('entries', 'invalid');
        $seen = [];
        foreach ($entries as &$entry) {
            if (!is_array($entry)) throw Input::invalid('entries', 'invalid');
            InventoryInput::only($entry, ['itemId', 'seriesId', 'number', 'originalIssuedOn']); $input = new Input($entry);
            if (isset($entry['itemId'])) {
                if (array_key_exists('seriesId', $entry) || array_key_exists('number', $entry)) throw Input::invalid('entries', 'invalid');
                $key = 'item:' . $input->id('itemId');
            } else { $entry['number'] = $input->text('number', 100); $key = 'number:' . $input->id('seriesId') . ':' . $entry['number']; }
            if (isset($seen[$key])) throw Input::invalid('entries', 'invalid'); $seen[$key] = true;
            $date = $input->optionalString('originalIssuedOn', 10);
            if ($date !== null && (!preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D', $date, $parts) || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]))) throw Input::invalid('originalIssuedOn', 'invalid');
            $entry['originalIssuedOn'] = $date;
        }
        unset($entry);
        try {
            $result = $this->audited($context, 'person.paper_migration', $unit, function () use ($unit, $person, $source, $entries, $note, $context): array {
                if ($source !== null) {
                    $query = $this->db()->prepare("SELECT id FROM attachments WHERE uuid = :uuid AND unit_id = :unit AND owner_type = 'person' AND owner_id = :person FOR KEY SHARE NOWAIT");
                    $query->execute(['uuid' => $source, 'unit' => $unit, 'person' => $person]); if ($query->fetchColumn() === false) throw self::notFound();
                }
                $query = $this->db()->prepare('SELECT id FROM persons WHERE id = :person FOR UPDATE NOWAIT'); $query->execute(['person' => $person]); if ($query->fetchColumn() === false) throw self::notFound();
                // Freeze numbering/retirement without waiting while holding a partial lock set.
                $this->db()->exec('LOCK TABLE costume_items IN SHARE MODE NOWAIT');
                $resolved = []; $ids = [];
                foreach ($entries as $entry) { $r = $this->resolve($unit, $entry); $resolved[] = $r; if (count($r['items']) === 1) $ids[] = (int) $r['items'][0]['id']; }
                $ids = array_values(array_unique($ids)); sort($ids);
                foreach ($ids as $id) $this->db()->query("SELECT id FROM costume_items WHERE id = $id FOR UPDATE NOWAIT")->fetchColumn();
                $results = []; $loans = new LoanRepository($this->db()); $items = new ItemRepository($this->db());
                foreach ($resolved as $index => $r) {
                    $entry = $entries[$index]; $item = count($r['items']) === 1 ? $r['items'][0] : null;
                    $code = count($r['items']) === 0 ? 'not_found' : (count($r['items']) > 1 ? 'ambiguous' : null);
                    $open = $item === null ? null : $loans->openItem((int) $item['id']);
                    if ($code === null && $open !== null && ($open['holder']['personId'] ?? null) === $person) {
                        $results[] = ['status' => 'already_recorded', 'label' => $r['label'], 'itemId' => (int) $item['id'], 'loanId' => $open['loanId']]; continue;
                    }
                    if ($code === null && $open !== null) $code = 'conflict';
                    if ($code === null && $item['retired_at'] !== null) $code = 'item_retired';
                    if ($code !== null) {
                        $query = $this->db()->prepare('INSERT INTO costume_paper_migration_findings (unit_id, person_id, source_attachment_uuid, item_id, series_id, number, label, input, code, conflicting_loan_id, note, by)
                            VALUES (:unit, :person, :source, :item, :series, :number, :label, CAST(:input AS jsonb), :code, :loan, :note, :actor) RETURNING id');
                        $query->execute(['unit' => $unit, 'person' => $person, 'source' => $source, 'item' => $item['id'] ?? null, 'series' => $r['seriesId'], 'number' => $entry['number'] ?? $item['number'] ?? null,
                            'label' => $r['label'], 'input' => json_encode($entry, JSON_THROW_ON_ERROR), 'code' => $code, 'loan' => $open['loanId'] ?? null, 'note' => $note, 'actor' => self::actor($context)]);
                        $results[] = ['status' => $code, 'label' => $r['label'], 'findingId' => (int) $query->fetchColumn(), 'itemId' => $item === null ? null : (int) $item['id'], 'loanId' => $open['loanId'] ?? null]; continue;
                    }
                    // Another identifier in this batch may already have imported this same piece.
                    $query = $this->db()->prepare("INSERT INTO costume_loans (unit_id, holder_person_id, issued_at, issued_by, origin, migrated_at, migrated_by, original_issued_on, note)
                        VALUES (:unit, :person, NULL, NULL, 'paper_migration', now(), :actor, :originalDate, :note) RETURNING id");
                    $query->execute(['unit' => $unit, 'person' => $person, 'actor' => self::actor($context), 'originalDate' => $entry['originalIssuedOn'], 'note' => $note]); $id = (int) $query->fetchColumn();
                    $loans->addLine($unit, $id, (int) $item['id'], null, 1); $loan = $loans->find($id);
                    $items->record((int) $item['id'], self::actor($context), 'paper_migration', ['loanId' => $id, 'holder' => ['personId' => $person], 'origin' => 'paper_migration', 'migratedAt' => $loan['migratedAt'], 'originalIssuedOn' => $entry['originalIssuedOn'], 'sourceAttachmentId' => $source]);
                    (new AuditLog($this->db()))->record(self::actor($context), 'loan.paper_migration', 'loan', $id, $unit, ['loan' => $loan, 'sourceAttachmentId' => $source]);
                    $results[] = ['status' => 'migrated', 'label' => $r['label'], 'itemId' => (int) $item['id'], 'loanId' => $id];
                }
                return ['id' => $person, 'results' => $results];
            });
        } catch (\PDOException $error) {
            if ($error->getCode() === '55P03') throw new HttpException(409, 'paper_migration_busy', 'The source evidence is changing. Retry the conversion.');
            throw $error;
        }
        return Response::json($result);
    }

    private function resolve(int $unit, array $entry): array
    {
        if (isset($entry['itemId'])) {
            $query = $this->db()->prepare('SELECT i.*, s.name AS series_name FROM costume_items i JOIN costume_series s ON s.id = i.series_id WHERE i.id = :id');
            $query->execute(['id' => $entry['itemId']]); $row = $query->fetch();
            if ($row !== false && (int) $row['unit_id'] !== $unit) throw self::notFound();
            return ['items' => $row === false ? [] : [$row], 'seriesId' => $row === false ? null : (int) $row['series_id'], 'label' => $row === false ? 'Neznámá součástka' : $row['series_name'] . ' ' . ($row['number'] ?? '(bez čísla)')];
        }
        $query = $this->db()->prepare('SELECT name FROM costume_series WHERE id = :id AND unit_id = :unit'); $query->execute(['id' => $entry['seriesId'], 'unit' => $unit]); $name = $query->fetchColumn();
        if ($name === false) throw self::notFound();
        $query = $this->db()->prepare('SELECT * FROM costume_items WHERE series_id = :series AND number = :number ORDER BY id'); $query->execute(['series' => $entry['seriesId'], 'number' => $entry['number']]);
        return ['items' => $query->fetchAll(), 'seriesId' => $entry['seriesId'], 'label' => $name . ' ' . $entry['number']];
    }

    private function findings(Request $request, RequestContext $context): Response
    {
        [$unit, $person] = $this->access($context, false); InventoryInput::only($request->query, ['limit', 'offset']); [$limit, $offset] = InventoryInput::pagination($request->query);
        $query = $this->db()->prepare('SELECT * FROM costume_paper_migration_findings WHERE unit_id = :unit AND person_id = :person ORDER BY at DESC, id DESC LIMIT :limit OFFSET :offset');
        $query->execute(['unit' => $unit, 'person' => $person, 'limit' => $limit, 'offset' => $offset]);
        $rows = array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'unitId' => (int) $r['unit_id'], 'personId' => (int) $r['person_id'], 'sourceAttachmentId' => $r['source_attachment_uuid'],
            'label' => $r['label'], 'input' => json_decode($r['input'], true, 64, JSON_THROW_ON_ERROR), 'code' => $r['code'], 'loanId' => $r['conflicting_loan_id'] === null ? null : (int) $r['conflicting_loan_id'], 'note' => $r['note'], 'at' => $r['at'], 'by' => (int) $r['by']], $query->fetchAll());
        $count = $this->db()->prepare('SELECT count(*) FROM costume_paper_migration_findings WHERE unit_id = :unit AND person_id = :person'); $count->execute(['unit' => $unit, 'person' => $person]);
        return Response::json(['items' => $rows, 'total' => (int) $count->fetchColumn()]);
    }
    private function access(RequestContext $context, bool $write): array
    {
        $unit = (new FundAccess($this->db()))->require($this->mandates($context), $context->params['unitId'], $write); $person = self::routeId($context);
        $query = $this->db()->prepare('SELECT id FROM persons WHERE id = :id'); $query->execute(['id' => $person]); if ($query->fetchColumn() === false) throw self::notFound(); return [$unit, $person];
    }
}
