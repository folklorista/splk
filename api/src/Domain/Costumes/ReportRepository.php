<?php

declare(strict_types=1);

namespace Splk\Api\Domain\Costumes;

use PDO;

/** Read-only complete reports; an export never silently stops at the first API page (D-39). */
final class ReportRepository
{
    public function __construct(private readonly PDO $db) {}

    public function build(int $unit, string $kind, ?int $id, array $filters): array
    {
        $nested = $this->db->inTransaction();
        return \Splk\Api\Infrastructure\Db\Transaction::run($this->db, function () use ($nested, $unit, $kind, $id, $filters): array {
            if (!$nested) $this->db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
            return $this->snapshot($unit, $kind, $id, $filters);
        });
    }
    private function snapshot(int $unit, string $kind, ?int $id, array $filters): array
    {
        $sections = []; $title = 'Soupis součástek';
        $kitSeries = false;
        if ($kind === 'series') { $q = $this->db->prepare('SELECT kind FROM costume_series WHERE id = :id'); $q->execute(['id' => $id]); $kitSeries = $q->fetchColumn() === 'kit'; }
        if ($kitSeries) {
            $kits = $this->all(fn ($offset) => (new KitRepository($this->db))->list($unit, 200, $offset, $id, null));
            $sections[] = $this->table('Komplety podle evidence; složení není fyzické ověření', ['Komplet ID', 'Řada', 'Číslo', 'Stav složení', 'Držitel'], array_map(fn ($k) => [$k['id'], $this->name('costume_series', $id), $k['number'], ReportLabels::label($k['compositionState']), $this->holder($k['holder'])], $kits));
        }
        if (!$kitSeries && in_array($kind, ['items', 'series', 'item'], true)) {
            $repository = new ItemRepository($this->db);
            if ($kind === 'item') $items = [$repository->find($id)];
            else $items = $this->all(fn ($offset) => $repository->list($unit, ['retired' => $filters['retired'] ?? false] + $filters + ($kind === 'series' ? ['series' => $id] : []), 200, $offset, 's.name ASC, i.number ASC'));
            if ($kind !== 'item' && !isset($filters['retired'])) $items = [...$items, ...$this->all(fn ($offset) => $repository->list($unit, ['retired' => true] + $filters + ($kind === 'series' ? ['series' => $id] : []), 200, $offset, 's.name ASC, i.number ASC'))];
            $sections[] = $this->table('Součástky podle evidence', ['Kus ID', 'Řada', 'Číslo', 'Stav', 'Umístění', 'Držitel', 'Vyřazeno', 'Pořízeno'], array_map(fn ($i) => [$i['id'], $this->name('costume_series', $i['seriesId']), $i['number'], $i['condition'], $i['location'], $this->holder($i['holder']), $i['retiredAt'], $i['acquiredOn']], $items));
            if ($kind === 'item') {
                $title = 'Současný a historický soupis součástky';
                $history = $this->all(fn ($offset) => $repository->history($id, 200, $offset));
                $sections[] = $this->table('Zaznamenaná historie; papírová minulost nemusí být úplná', ['Datum zápisu', 'Událost', 'Autor účtu', 'Údaje'], array_map(fn ($e) => [$e['at'], $e['event'], $e['by'], $this->eventDetails($e['data'])], $history));
            }
        }
        if (in_array($kind, ['loans', 'person', 'item', 'series'], true)) {
            $repository = new LoanRepository($this->db); $loanFilters = $kind === 'person' ? ['person' => $id] : [];
            $loans = $this->all(fn ($offset) => $repository->list($unit, $loanFilters + array_intersect_key($filters, array_flip(['open', 'overdue', 'holderType'])), 200, $offset));
            $rows = [];
            foreach ($loans as $loan) foreach ($loan['lines'] as $line) {
                if ($kind === 'item' && $line['itemId'] !== $id) continue;
                if ($kind === 'series' && ($kitSeries ? !in_array($loan['kitId'], array_column($kits, 'id'), true) : !in_array($line['itemId'], array_column($items, 'id'), true))) continue;
                $rows[] = [$loan['id'], $this->holder($loan['holder']), $line['label'], $line['qty'], $line['returnedQty'], $line['closedAt'] === null ? $line['qty'] - $line['returnedQty'] : 0,
                    $loan['origin'], $loan['issuedAt'], $loan['migratedAt'], $loan['originalIssuedOn'], $loan['dueAt'], $line['closeType']];
            }
            $sections[] = $this->table('Držení a výpůjčky podle evidence', ['Výpůjčka ID', 'Držitel', 'Součást', 'Původně', 'Vráceno', 'Zbývá', 'Původ', 'Skutečný výdej', 'Digitalizace', 'Původní datum z papíru', 'Termín', 'Uzavření'], $rows);
            if ($kind === 'person') $title = 'Krojová karta · ' . $this->holder(['personId' => $id]);
            if ($kind === 'loans') $title = 'Výpůjčky a nevrácené součástky';
        }
        if ($kind === 'kit') {
            $kit = (new KitRepository($this->db))->detail($id); $title = 'Komplet · ' . $this->name('costume_series', $kit['seriesId']) . ' ' . $kit['number'];
            $sections[] = $this->table('Určené složení, nikoli fyzické ověření · ' . ReportLabels::label($kit['compositionState']), ['Kus ID', 'Řada', 'Číslo', 'Držitel', 'Umístění'], array_map(fn ($i) => [$i['id'], $this->name('costume_series', $i['seriesId']), $i['number'], $this->holder($i['holder']), $i['location']], $kit['items']));
            $sections[] = $this->table('Nečíslované doplňky; počty v evidenci nejsou potvrzení přítomnosti', ['Zásoba ID', 'Požadováno', 'Evidováno', 'Chybí podle evidence'], array_map(fn ($l) => [$l['bulkStockId'], $l['requiredQty'], $l['presentQty'], max(0, $l['requiredQty'] - $l['presentQty'])], $kit['bulkLines']));
        }
        if ($kind === 'inventory') {
            $repo = new InventoryRepository($this->db); $inventory = $repo->find($id); $title = 'Inventura · ' . $inventory['name'];
            $targets = $inventory['status'] === 'closed' ? $inventory['resultSnapshot']['targets'] : $repo->targets($id);
            $checks = $inventory['status'] === 'closed' ? $inventory['resultSnapshot']['checks'] : $repo->checks($id);
            $progress = $repo->progress($inventory);
            $sections[] = $this->table('Zmrazený inventurní soupis', ['Cíl ID', 'Popis při zahájení', 'Očekávaný počet', 'Držitel při zahájení'], array_map(fn ($t) => [$t['id'], $t['snapshot']['label'] ?? json_encode($t['snapshot'], JSON_UNESCAPED_UNICODE), $t['expectedQty'], $this->holder($t['holderPersonId'] !== null ? ['personId' => $t['holderPersonId']] : ($t['holderUnitId'] !== null ? ['unitId' => $t['holderUnitId']] : null))], $targets));
            $sections[] = $this->table('Skutečně zapsané kontroly včetně zrušených', ['Cíl ID', 'Datum', 'Výsledek', 'Stav', 'Zjištěný počet', 'Zrušeno', 'Poznámka'], array_map(fn ($c) => [$c['targetId'], $c['at'], $c['result'], $c['condition'], $c['checkedQty'], $c['cancelledAt'], $c['note']], $checks));
            $sections[] = $this->table('Nesrovnalosti; zásoby mimo procento kusů', ['Cíl ID', 'Druh', 'Podrobnosti'], array_map(fn ($i) => [$i['targetId'], $i['kind'], ReportLabels::details($i)], $progress['issues']));
        }
        if ($kind === 'work-orders') {
            $title = 'Pracovní úkoly'; $orders = $this->all(fn ($offset) => (new WorkOrderRepository($this->db))->list($unit, null, null, 200, $offset));
            $sections[] = $this->table('Opravy a další úkoly', ['Úkol ID', 'Kus ID', 'Typ', 'Stav', 'Popis', 'Termín'], array_map(fn ($o) => [$o['id'], $o['itemId'], $o['type'], $o['status'], $o['description'], $o['dueOn']], $orders));
        }
        return ['unitId' => $unit, 'generatedAt' => gmdate('c'), 'title' => $title, 'notice' => 'Podle evidence v okamžiku sestavení. Pouze výslovná nezrušená inventurní kontrola je fyzické ověření. Historická evidence nemusí být úplná.', 'sections' => $sections];
    }
    private function eventDetails(array $data): string {
        $text = ReportLabels::details($data);
        if (isset($data['holder'])) $text = trim($text . ' · Držitel: ' . $this->holder($data['holder']), ' ·');
        return $text;
    }
    private function all(callable $read): array { $rows = []; do { $page = $read(count($rows)); $rows = [...$rows, ...$page['items']]; } while (count($rows) < $page['total'] && $page['items'] !== []); return $rows; }
    private function table(string $title, array $columns, array $rows): array {
        $enumColumns = ['Stav', 'Umístění', 'Původ', 'Uzavření', 'Událost', 'Výsledek', 'Druh', 'Typ'];
        foreach ($rows as &$row) foreach ($row as $index => &$value) if (is_string($value) && in_array($columns[$index], $enumColumns, true)) $value = ReportLabels::label($value);
        return compact('title', 'columns', 'rows');
    }
    private function name(string $table, int $id): ?string { $query = $this->db->prepare("SELECT name FROM $table WHERE id = :id"); $query->execute(['id' => $id]); return $query->fetchColumn() ?: null; }
    private function holder(?array $holder): ?string {
        if ($holder === null) return null;
        if (isset($holder['unitId'])) return $this->name('units', $holder['unitId']);
        $query = $this->db->prepare("SELECT concat_ws(' ', first_name, last_name, nickname) FROM persons WHERE id = :id"); $query->execute(['id' => $holder['personId']]); return $query->fetchColumn() ?: null;
    }
}
