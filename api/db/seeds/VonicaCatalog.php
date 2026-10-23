<?php

declare(strict_types=1);

use Phinx\Seed\AbstractSeed;

/**
 * Default catalog of the adult Vonica fund from the paper stock cards (current/krojarka/krojovy-katalog-vonica.json,
 * schema krojovy-katalog-navrh-2, copied to data/; D-37):
 * - regions Horňácko, Kopanice, Slovensko (areas Zemplín, Moravské Lieskové), Zálesí;
 * - one part type per catalog row; footwear has no region except "horňácké tvrdé" (Horňácko), so the soft
 *   shoes stay usable as a universal replacement;
 * - one part series per numbered part type (unnumbered kytička, korále, mašle have none, D-35).
 * Runs only while the fund has no regions. Depends on VonicaUnits.
 */
final class VonicaCatalog extends AbstractSeed
{
    public function getDependencies(): array
    {
        return ['VonicaUnits'];
    }

    public function run(): void
    {
        $pdo = $this->getAdapter()->getConnection();
        $unitId = $pdo->query("SELECT id FROM units WHERE name = 'Vonica' AND has_costume_fund")->fetchColumn();
        if ($unitId === false) {
            throw new RuntimeException('Unit "Vonica" with a costume fund not found – run VonicaUnits first.');
        }
        $exists = $pdo->prepare('SELECT 1 FROM costume_regions WHERE unit_id = :unit');
        $exists->execute(['unit' => $unitId]);
        if ($exists->fetchColumn() !== false) {
            $this->getOutput()->writeln('Vonica fund already has a catalog – nothing to do');

            return;
        }

        $region = $pdo->prepare('INSERT INTO costume_regions (unit_id, name, parent_id) VALUES (:unit, :name, :parent) RETURNING id');
        $regionId = static function (string $name, ?int $parent = null) use ($region, $unitId): int {
            $region->execute(['unit' => $unitId, 'name' => $name, 'parent' => $parent]);

            return (int) $region->fetchColumn();
        };
        $regions = ['Horňácko' => $regionId('Horňácko'), 'Kopanice' => $regionId('Kopanice')];
        $slovensko = $regionId('Slovensko');
        $regions += [
            'Slovensko' => $slovensko,
            'Zemplín' => $regionId('Zemplín', $slovensko),
            'Moravské Lieskové' => $regionId('Moravské Lieskové', $slovensko),
            'Zálesí' => $regionId('Zálesí'),
        ];

        $catalog = json_decode((string) file_get_contents(__DIR__ . '/data/krojovy-katalog-vonica.json'), true, 16, JSON_THROW_ON_ERROR);
        $partType = $pdo->prepare(
            'INSERT INTO costume_part_types (unit_id, name, gender, region_id, numbered)
             VALUES (:unit, :name, :gender, :region, :numbered) RETURNING id'
        );
        $series = $pdo->prepare(
            "INSERT INTO costume_series (unit_id, kind, name, part_type_id, region_id, gender)
             VALUES (:unit, 'part', :name, :type, :region, :gender)"
        );
        $types = 0;
        $seriesCount = 0;
        foreach ($catalog['items'] as $item) {
            $gender = $item['pohlavi'] === 'muži' ? 'male' : 'female';
            $group = $item['skupina'] === 'Slovensko' ? ($item['oblast'] ?? 'Zemplín') : $item['skupina'];
            $region = match (true) {
                $group !== 'Obuv' => $regions[$group] ?? throw new RuntimeException("Unknown group {$item['skupina']}"),
                $item['nazev'] === 'horňácké tvrdé' => $regions['Horňácko'],
                default => null,
            };
            $partType->execute(['unit' => $unitId, 'name' => $item['nazev'], 'gender' => $gender, 'region' => $region,
                'numbered' => $item['cislovano'] ? 'true' : 'false']);
            $typeId = (int) $partType->fetchColumn();
            $types++;
            if ($item['cislovano']) {
                $series->execute(['unit' => $unitId, 'name' => $item['nazev'], 'type' => $typeId, 'region' => $region, 'gender' => $gender]);
                $seriesCount++;
            }
        }
        $this->getOutput()->writeln(sprintf('Vonica fund: %d regions, %d part types, %d series', count($regions), $types, $seriesCount));
    }
}
