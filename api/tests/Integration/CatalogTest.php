<?php

declare(strict_types=1);

namespace Splk\Api\Tests\Integration;

/** /v1/funds/{unitId}/regions|part-types|series – fund scoping, read-only mandates, catalog rules. */
final class CatalogTest extends ApiTestCase
{
    private int $fund;
    private int $otherFund;
    private int $krojarka;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fund = $this->createUnit('Vonica');
        $this->otherFund = $this->createUnit('Malá Vonica');
        $this->krojarka = $this->createAccount();
        $this->grant($this->krojarka, 'costumes.manage', $this->fund);
        $this->signInAs($this->krojarka);
    }

    public function testKrojarkaBuildsCatalogOfHerFund(): void
    {
        $slovensko = $this->post($this->url('regions'), ['name' => 'Slovensko'])->decodedBody();
        $zemplin = $this->post($this->url('regions'), ['name' => 'Zemplín', 'parentId' => $slovensko['id']]);
        self::assertStatus(201, $zemplin);
        self::assertSame(['id' => $zemplin->decodedBody()['id'], 'name' => 'Zemplín', 'parentId' => $slovensko['id'], 'archived' => false], $zemplin->decodedBody());

        $type = $this->post($this->url('part-types'), ['name' => 'košile stuhová', 'gender' => 'male', 'regionId' => $zemplin->decodedBody()['id']]);
        self::assertStatus(201, $type);
        self::assertTrue($type->decodedBody()['numbered']);

        $series = $this->post($this->url('series'), ['kind' => 'part', 'partTypeId' => $type->decodedBody()['id']]);
        self::assertStatus(201, $series);
        self::assertSame('košile stuhová', $series->decodedBody()['name'], 'name, gender and region default to the part type');
        self::assertSame('male', $series->decodedBody()['gender']);
        self::assertSame($zemplin->decodedBody()['id'], $series->decodedBody()['regionId']);
        self::assertTrue($series->decodedBody()['allowNumberReuse'], 'number reuse is allowed by default (D-20)');

        self::assertCount(2, $this->get($this->url('regions'))->decodedBody()['items']);
        self::assertSame(1, $this->auditCount('series.create'));
    }

    public function testVariantMaySplitSeriesButNamesStayUniquePerVariant(): void
    {
        $type = $this->post($this->url('part-types'), ['name' => 'košile', 'gender' => 'male'])->decodedBody();

        self::assertStatus(201, $this->post($this->url('series'), ['kind' => 'part', 'partTypeId' => $type['id'], 'variant' => 'Velická']));
        self::assertStatus(201, $this->post($this->url('series'), ['kind' => 'part', 'partTypeId' => $type['id'], 'variant' => 'Novolhotská']));
        self::assertError(422, 'duplicate_name', $this->post($this->url('series'), ['kind' => 'part', 'partTypeId' => $type['id'], 'variant' => 'velická']));
        self::assertError(422, 'duplicate_name', $this->post($this->url('part-types'), ['name' => 'Košile', 'gender' => 'male']));
        self::assertStatus(201, $this->post($this->url('part-types'), ['name' => 'košile', 'gender' => 'female']));
    }

    public function testKitSeriesHaveNoPartTypeAndUnnumberedTypesNoSeries(): void
    {
        $kytička = $this->post($this->url('part-types'), ['name' => 'kytička', 'gender' => 'female', 'numbered' => false])->decodedBody();
        $košile = $this->post($this->url('part-types'), ['name' => 'košile'])->decodedBody();

        self::assertError(422, 'part_type_not_numbered', $this->post($this->url('series'), ['kind' => 'part', 'partTypeId' => $kytička['id']]));
        self::assertError(422, 'validation_failed', $this->post($this->url('series'), ['kind' => 'kit', 'name' => 'Záleský komplet', 'partTypeId' => $košile['id']]));
        self::assertError(422, 'validation_failed', $this->post($this->url('series'), ['kind' => 'part']));

        $kit = $this->post($this->url('series'), ['kind' => 'kit', 'name' => 'Záleský komplet', 'gender' => 'male']);
        self::assertStatus(201, $kit);
        self::assertNull($kit->decodedBody()['partTypeId']);
    }

    public function testSeriesKindAndPartTypeCannotChangeButOtherFieldsCan(): void
    {
        $type = $this->post($this->url('part-types'), ['name' => 'košile'])->decodedBody();
        $other = $this->post($this->url('part-types'), ['name' => 'pruclek'])->decodedBody();
        $series = $this->post($this->url('series'), ['kind' => 'part', 'partTypeId' => $type['id']])->decodedBody();
        $path = $this->url('series/' . $series['id']);

        self::assertSame('immutable', $this->patch($path, ['partTypeId' => $other['id']])->decodedBody()['error']['details']['reason']);
        self::assertSame('immutable', $this->patch($path, ['kind' => 'kit'])->decodedBody()['error']['details']['reason']);

        $updated = $this->patch($path, ['name' => 'košile horňácká', 'allowNumberReuse' => false, 'archived' => true, 'partTypeId' => $type['id']]);
        self::assertStatus(200, $updated);
        self::assertSame(['košile horňácká', false, true], [$updated->decodedBody()['name'], $updated->decodedBody()['allowNumberReuse'], $updated->decodedBody()['archived']]);
        self::assertSame(1, $this->auditCount('series.update'));
    }

    public function testArchivedNameCanBeUsedAgain(): void
    {
        $region = $this->post($this->url('regions'), ['name' => 'Zálesí'])->decodedBody();
        $this->patch($this->url('regions/' . $region['id']), ['archived' => true]);

        self::assertStatus(201, $this->post($this->url('regions'), ['name' => 'Zálesí']));
    }

    public function testRegionsHaveTwoLevelsAndStayInTheirFund(): void
    {
        $slovensko = $this->post($this->url('regions'), ['name' => 'Slovensko'])->decodedBody();
        $zemplin = $this->post($this->url('regions'), ['name' => 'Zemplín', 'parentId' => $slovensko['id']])->decodedBody();

        self::assertError(422, 'validation_failed', $this->post($this->url('regions'), ['name' => 'Obec', 'parentId' => $zemplin['id']]));
        self::assertSame('region_has_children', $this->patch($this->url('regions/' . $slovensko['id']), ['parentId' => $this->post($this->url('regions'), ['name' => 'Horňácko'])->decodedBody()['id']])->decodedBody()['error']['details']['reason']);
        self::assertError(422, 'validation_failed', $this->patch($this->url('regions/' . $slovensko['id']), ['parentId' => $slovensko['id']]));

        $foreign = $this->foreignRegion();
        self::assertError(422, 'validation_failed', $this->post($this->url('part-types'), ['name' => 'čižmy', 'regionId' => $foreign]));
        self::assertError(404, 'not_found', $this->patch($this->url('regions/' . $foreign), ['name' => 'X']));
    }

    public function testFundWithoutMandateIsNotFound(): void
    {
        foreach (['regions', 'part-types', 'series'] as $resource) {
            self::assertError(404, 'not_found', $this->get("/v1/funds/{$this->otherFund}/$resource"));
            self::assertError(404, 'not_found', $this->post("/v1/funds/{$this->otherFund}/$resource", ['name' => 'X']));
        }
        self::assertError(404, 'not_found', $this->get('/v1/funds/999999/regions'));
        self::assertError(404, 'not_found', $this->get('/v1/funds/abc/regions'));
    }

    public function testUnitWithoutCostumeFundIsNotFoundEvenWithMandate(): void
    {
        $band = $this->createUnit('Muzika', false);
        $this->grant($this->krojarka, 'costumes.manage', $band);

        self::assertError(404, 'not_found', $this->get("/v1/funds/$band/regions"));
    }

    public function testReadOnlyMandateCanReadButNotWrite(): void
    {
        $auditor = $this->createAccount(email: 'audit@example.test');
        $this->grant($auditor, 'costumes.view', $this->fund);
        $this->signInAs($auditor);

        self::assertStatus(200, $this->get($this->url('series')));
        self::assertError(403, 'forbidden', $this->post($this->url('regions'), ['name' => 'Horňácko']));
        self::assertSame(0, $this->auditCount('region.create'));
    }

    public function testOrganizationWideViewReadsEveryFund(): void
    {
        $auditor = $this->createAccount(email: 'audit@example.test');
        $this->grant($auditor, 'costumes.view');
        $this->signInAs($auditor);

        self::assertStatus(200, $this->get("/v1/funds/{$this->otherFund}/regions"));
        self::assertError(403, 'forbidden', $this->post("/v1/funds/{$this->otherFund}/regions", ['name' => 'X']));
    }

    public function testOrganizationAdminHasNoFundAccess(): void
    {
        $admin = $this->createAccount(email: 'admin@example.test');
        $this->grant($admin, 'organization.admin');
        $this->signInAs($admin);

        self::assertError(404, 'not_found', $this->get($this->url('regions')));
    }

    public function testRevokedMandateNoLongerGivesAccess(): void
    {
        $this->db->exec("UPDATE mandates SET revoked_at = now() WHERE person_id = (SELECT person_id FROM user_accounts WHERE id = {$this->krojarka})");

        self::assertError(404, 'not_found', $this->get($this->url('regions')));
    }

    public function testInputIsValidated(): void
    {
        self::assertSame('required', $this->post($this->url('regions'), ['name' => '  '])->decodedBody()['error']['details']['reason']);
        self::assertSame('invalid', $this->post($this->url('part-types'), ['name' => 'x', 'gender' => 'other'])->decodedBody()['error']['details']['reason']);
        self::assertSame('invalid', $this->post($this->url('part-types'), ['name' => 'x', 'numbered' => 'yes'])->decodedBody()['error']['details']['reason']);
    }

    private function url(string $resource): string
    {
        return "/v1/funds/{$this->fund}/$resource";
    }

    private function foreignRegion(): int
    {
        return (int) $this->db->query("INSERT INTO costume_regions (unit_id, name) VALUES ({$this->otherFund}, 'Cizí') RETURNING id")->fetchColumn();
    }
}
