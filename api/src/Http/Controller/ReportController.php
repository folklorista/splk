<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Authorization\FundAccess;
use Splk\Api\Domain\Costumes\ReportRepository;
use Splk\Api\Http\{Input, InventoryInput, Request, RequestContext, Response, Router};

final class ReportController extends Controller
{
    public function register(Router $router): void
    {
        foreach (['series', 'person', 'item', 'kit', 'inventory'] as $kind) $router->add('GET', '/v1/funds/{unitId}/reports/' . $kind . '/{id}', fn (Request $r, RequestContext $c): Response => $this->report($r, $c, $kind));
        foreach (['items', 'loans', 'work-orders'] as $kind) $router->add('GET', '/v1/funds/{unitId}/reports/' . $kind, fn (Request $r, RequestContext $c): Response => $this->report($r, $c, $kind));
    }
    private function report(Request $request, RequestContext $context, string $kind): Response
    {
        $unit = (new FundAccess($this->db()))->require($this->mandates($context), $context->params['unitId'], false);
        $id = isset($context->params['id']) ? self::routeId($context) : null;
        if ($id !== null) {
            $table = ['series' => 'costume_series', 'person' => 'persons', 'item' => 'costume_items', 'kit' => 'costume_kits', 'inventory' => 'inventories'][$kind];
            $sql = "SELECT id FROM $table WHERE id = :id" . ($kind === 'person' ? '' : ' AND unit_id = :unit');
            $query = $this->db()->prepare($sql); $query->execute($kind === 'person' ? ['id' => $id] : ['id' => $id, 'unit' => $unit]); if ($query->fetchColumn() === false) throw self::notFound();
        }
        $allowed = match ($kind) { 'items', 'series' => ['condition', 'location', 'retired', 'available', 'acquiredFrom', 'acquiredTo'], 'loans', 'person' => ['open', 'overdue', 'holderType'], 'work-orders' => ['status'], default => [] };
        InventoryInput::only($request->query, $allowed); $filters = [];
        foreach ($request->query as $field => $value) {
            $filters[$field] = match ($field) {
                'retired', 'available', 'open', 'overdue' => match ($value) { 'true' => true, 'false' => false, default => throw Input::invalid($field, 'invalid') },
                'condition' => (new Input($request->query))->enum($field, ['ok', 'damaged', 'needs_adjustment']),
                'location' => (new Input($request->query))->enum($field, ['store', 'holder', 'seamstress', 'repair', 'unknown']),
                'status' => (new Input($request->query))->enum($field, ['active', 'open', 'in_progress', 'done', 'cancelled']),
                'holderType' => (new Input($request->query))->enum($field, ['external']),
                default => $this->date($value, $field),
            };
        }
        if (isset($filters['acquiredFrom'], $filters['acquiredTo']) && $filters['acquiredFrom'] > $filters['acquiredTo']) throw Input::invalid('acquiredTo', 'invalid');
        $report = (new ReportRepository($this->db()))->build($unit, $kind, $id, $filters);
        if (str_contains($request->header('accept') ?? '', 'text/csv')) return new Response(200, ['Content-Type' => 'text/csv; charset=utf-8', 'Content-Disposition' => 'attachment; filename="soupis.csv"', 'Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff'], self::csv($report));
        return Response::json($report)->withHeader('Cache-Control', 'no-store');
    }
    public static function csv(array $report): string
    {
        $file = fopen('php://temp', 'w+'); fwrite($file, "\xEF\xBB\xBF");
        $write = static function (array $cells) use ($file): void { fputcsv($file, array_map(static fn ($v): string => is_string($v) && !preg_match('/^-?[0-9]+(?:\.[0-9]{1,4})?$/D', $v) && preg_match('/^[\s\x00-\x1f]*[=+@-]/u', $v) ? "'" . $v : (string) ($v ?? ''), $cells), ';', '"', '', "\r\n"); };
        $write([$report['title'], $report['generatedAt'], $report['notice']]);
        foreach ($report['sections'] as $section) { $write([]); $write([$section['title']]); $write($section['columns']); foreach ($section['rows'] as $row) $write($row); }
        rewind($file); $content = stream_get_contents($file); fclose($file); return $content;
    }
    private function date(mixed $value, string $field): string
    {
        if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $value, $p) || !checkdate((int) $p[2], (int) $p[3], (int) $p[1])) throw Input::invalid($field, 'invalid'); return $value;
    }
}
