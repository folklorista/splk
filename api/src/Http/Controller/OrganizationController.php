<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Auth\PasswordResets;
use Splk\Api\Auth\SessionStore;
use Splk\Api\Domain\Identity\OrganizationRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;

/**
 * Nastavení → Uživatelé a pověření (api-v1 chap. 4.2, D-48): persons, accounts, mandates and units.
 * Everything except the unit list requires organization.admin, which itself gives no access to costume funds.
 * Mandates are revoked, never deleted; the last usable organization.admin cannot be revoked.
 */
final class OrganizationController extends Controller
{
    private const KINDS = ['costumes.manage', 'costumes.view', 'costs.view', 'organization.admin'];

    /**
     * @param \Closure(): \PDO $db
     * @param \Closure(): PasswordResets $passwordLinks
     * @param \Closure(): SessionStore $sessions
     */
    public function __construct(\Closure $db, private readonly \Closure $passwordLinks, private readonly \Closure $sessions)
    {
        parent::__construct($db);
    }

    public function register(Router $router): void
    {
        $router->add('GET', '/v1/units', $this->listUnits(...));
        $router->add('POST', '/v1/units', $this->createUnit(...));
        $router->add('PATCH', '/v1/units/{id}', $this->updateUnit(...));
        $router->add('GET', '/v1/persons', $this->listPersons(...));
        $router->add('POST', '/v1/persons', $this->createPerson(...));
        $router->add('PATCH', '/v1/persons/{id}', $this->updatePerson(...));
        $router->add('POST', '/v1/accounts', $this->createAccount(...));
        $router->add('POST', '/v1/accounts/{id}/invite', $this->resendInvitation(...));
        $router->add('POST', '/v1/accounts/{id}/disable', $this->disableAccount(...));
        $router->add('POST', '/v1/accounts/{id}/enable', $this->enableAccount(...));
        $router->add('POST', '/v1/mandates', $this->grantMandate(...));
        $router->add('DELETE', '/v1/mandates/{id}', $this->revokeMandate(...));
    }

    /** Unit names are not confidential inside the organization; every signed-in user may list them. */
    private function listUnits(Request $request, RequestContext $context): Response
    {
        return Response::json(['items' => $this->repository()->units()]);
    }

    private function createUnit(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $input = Input::fromRequest($request);
        $unit = [
            'name' => $input->text('name'),
            'shortName' => $input->optionalString('shortName', 50),
            'hasCostumeFund' => $input->bool('hasCostumeFund', false),
        ];

        return Response::json($this->audited($context, 'unit.create', null, function () use ($unit, $context): array {
            return $this->repository()->findUnit($this->repository()->insertUnit($unit, self::actor($context)));
        }), 201);
    }

    private function updateUnit(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $current = $this->repository()->findUnit(self::routeId($context)) ?? throw self::notFound();
        $input = Input::fromRequest($request);
        $unit = [
            'name' => $input->has('name') ? $input->text('name') : $current['name'],
            'shortName' => $input->has('shortName') ? $input->optionalString('shortName', 50) : $current['shortName'],
            'hasCostumeFund' => $input->has('hasCostumeFund') ? $input->bool('hasCostumeFund') : $current['hasCostumeFund'],
            'archived' => $input->has('archived') ? $input->bool('archived') : $current['archived'],
        ];

        return Response::json($this->audited($context, 'unit.update', $current['id'], function () use ($current, $unit): array {
            $this->repository()->updateUnit($current['id'], $unit);

            return $this->repository()->findUnit($current['id']);
        }));
    }

    private function listPersons(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();

        return Response::json(['items' => $this->repository()->persons()]);
    }

    private function createPerson(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $person = self::personInput(Input::fromRequest($request), null);

        return Response::json($this->audited($context, 'person.create', null, function () use ($person, $context): array {
            return $this->repository()->findPerson($this->repository()->insertPerson($person, self::actor($context)));
        }), 201);
    }

    private function updatePerson(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $current = $this->repository()->findPerson(self::routeId($context)) ?? throw self::notFound();
        $person = self::personInput(Input::fromRequest($request), $current);

        return Response::json($this->audited($context, 'person.update', null, function () use ($current, $person): array {
            $this->repository()->updatePerson($current['id'], $person);

            return $this->repository()->findPerson($current['id']);
        }));
    }

    /** Creates an invited account and e-mails a link to set the first password. */
    private function createAccount(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $input = Input::fromRequest($request);
        $person = $this->repository()->findPerson($input->id('personId')) ?? throw Input::invalid('personId', 'invalid');
        $email = $input->email('email');
        if ($person['account'] !== null) {
            throw new HttpException(422, 'account_exists', 'The person already has an account.');
        }

        $result = $this->audited($context, 'account.create', null, function () use ($person, $email, $context): array {
            $accountId = $this->repository()->insertAccount($person['id'], $email, self::actor($context));
            $sent = ($this->passwordLinks)()->invite($accountId, $email, $person['firstName']);

            return ['id' => $accountId, 'person' => $this->repository()->findPerson($person['id']), 'invitationSent' => $sent];
        }, 'email_taken', ['personId' => $person['id'], 'loginEmail' => $email]);

        return Response::json(['person' => $result['person'], 'invitationSent' => $result['invitationSent']], 201);
    }

    private function resendInvitation(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $account = $this->repository()->findAccount(self::routeId($context)) ?? throw self::notFound();
        if ($account['status'] !== 'invited') {
            throw new HttpException(422, 'account_not_invited', 'Only an invited account can get an invitation.');
        }
        $person = $this->repository()->findPerson($account['personId']);

        $result = $this->audited($context, 'account.invite', null, fn (): array => [
            'id' => $account['id'],
            'invitationSent' => ($this->passwordLinks)()->invite($account['id'], $account['loginEmail'], $person['firstName']),
        ]);

        return Response::json(['invitationSent' => $result['invitationSent']]);
    }

    private function disableAccount(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $account = $this->repository()->findAccount(self::routeId($context)) ?? throw self::notFound();
        if ($account['id'] === self::actor($context)) {
            throw new HttpException(422, 'cannot_disable_self', 'You cannot disable your own account.');
        }

        $this->audited($context, 'account.disable', null, function () use ($account): array {
            $this->repository()->setAccountStatus($account['id'], 'disabled');
            ($this->sessions)()->destroyAllForAccount($account['id']);

            return ['id' => $account['id'], 'loginEmail' => $account['loginEmail']];
        });

        return Response::json($this->repository()->findPerson($account['personId']));
    }

    private function enableAccount(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $account = $this->repository()->findAccount(self::routeId($context)) ?? throw self::notFound();
        if ($account['status'] !== 'disabled') {
            throw new HttpException(422, 'account_not_disabled', 'The account is not disabled.');
        }

        $this->audited($context, 'account.enable', null, function () use ($account): array {
            $this->repository()->setAccountStatus($account['id'], $account['hasPassword'] ? 'active' : 'invited');

            return ['id' => $account['id'], 'loginEmail' => $account['loginEmail']];
        });

        return Response::json($this->repository()->findPerson($account['personId']));
    }

    private function grantMandate(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $input = Input::fromRequest($request);
        $person = $this->repository()->findPerson($input->id('personId')) ?? throw Input::invalid('personId', 'invalid');
        $kind = $input->enum('kind', self::KINDS);
        $unitId = $input->nullableId('unitId');
        $this->assertScope($kind, $unitId);
        if ($this->repository()->hasActiveMandate($person['id'], $kind, $unitId)) {
            throw new HttpException(422, 'mandate_exists', 'The person already has this mandate.');
        }

        $result = $this->audited($context, 'mandate.grant', $unitId, function () use ($person, $kind, $unitId, $context): array {
            $id = $this->repository()->insertMandate($person['id'], $kind, $unitId, self::actor($context));

            return $this->repository()->findActiveMandate($id);
        });

        return Response::json($result, 201);
    }

    private function revokeMandate(Request $request, RequestContext $context): Response
    {
        $this->mandates($context)->requireOrganizationAdmin();
        $mandate = $this->repository()->findActiveMandate(self::routeId($context)) ?? throw self::notFound();

        $this->audited($context, 'mandate.revoke', $mandate['scopeId'], function () use ($mandate, $context): array {
            $this->repository()->revokeMandate($mandate['id'], self::actor($context));
            if ($mandate['kind'] === 'organization.admin' && $this->repository()->countUsableAdmins() === 0) {
                // rolled back with the revocation – the organization must keep somebody who can manage it
                throw new HttpException(422, 'last_admin', 'The last organization administrator cannot be removed.');
            }

            return $mandate;
        });

        return Response::noContent();
    }

    /** Scopes of the v1 mandate kinds (api-v1 chap. 2.3): costume mandates per fund, the others organization-wide. */
    private function assertScope(string $kind, ?int $unitId): void
    {
        $organizationOnly = in_array($kind, ['costs.view', 'organization.admin'], true);
        if ($organizationOnly && $unitId !== null) {
            throw Input::invalid('unitId', 'organization_scope_only');
        }
        if ($kind === 'costumes.manage' && $unitId === null) {
            throw Input::invalid('unitId', 'required');
        }
        if ($unitId !== null) {
            $unit = $this->repository()->findUnit($unitId);
            if ($unit === null || $unit['archived'] || !$unit['hasCostumeFund']) {
                throw Input::invalid('unitId', 'not_a_costume_fund');
            }
        }
    }

    /** @param array<string, mixed>|null $current */
    private static function personInput(Input $input, ?array $current): array
    {
        $field = static fn (string $name, callable $read): mixed => $current === null || $input->has($name) ? $read() : $current[$name];

        return [
            'firstName' => $field('firstName', fn () => $input->text('firstName', 100)),
            'lastName' => $field('lastName', fn () => $input->text('lastName', 100)),
            'nickname' => $field('nickname', fn () => $input->optionalString('nickname', 100)),
            'contact' => $field('contact', fn () => $input->optionalString('contact', 500)),
            'note' => $field('note', fn () => $input->optionalString('note', 2000)),
        ];
    }

    private function repository(): OrganizationRepository
    {
        return new OrganizationRepository($this->db());
    }
}
