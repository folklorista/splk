<?php

declare(strict_types=1);

namespace Splk\Api\Http\Controller;

use Splk\Api\Auth\LoginThrottle;
use Splk\Api\Auth\Passwords;
use Splk\Api\Auth\PasswordResets;
use Splk\Api\Auth\Session;
use Splk\Api\Auth\SessionCookie;
use Splk\Api\Auth\SessionStore;
use Splk\Api\Domain\Identity\AccountRepository;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Input;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;

/** /v1/auth/* – login, account and password (api-v1 chap. 4.1, D-12, D-49, D-53). */
final class AuthController
{
    /**
     * Services are resolved lazily so that routing a request does not open a database connection.
     *
     * @param \Closure(): AccountRepository $accounts
     * @param \Closure(): SessionStore $sessions
     * @param \Closure(): LoginThrottle $throttle
     * @param \Closure(): PasswordResets $resets
     */
    public function __construct(
        private readonly \Closure $accounts,
        private readonly \Closure $sessions,
        private readonly \Closure $throttle,
        private readonly \Closure $resets,
        private readonly SessionCookie $cookie,
        private readonly int $sessionLifetime,
    ) {
    }

    public function register(Router $router): void
    {
        $router->add('POST', '/v1/auth/login', $this->login(...), ['auth' => false]);
        $router->add('POST', '/v1/auth/logout', $this->logout(...));
        $router->add('GET', '/v1/auth/me', $this->me(...));
        $router->add('POST', '/v1/auth/password', $this->changePassword(...));
        $router->add('POST', '/v1/auth/password-reset', $this->requestReset(...), ['auth' => false]);
        $router->add('POST', '/v1/auth/password-reset/confirm', $this->confirmReset(...), ['auth' => false]);
        $router->add('GET', '/v1/auth/sessions', $this->listSessions(...));
        $router->add('DELETE', '/v1/auth/sessions/{id}', $this->deleteSession(...));
    }

    private function login(Request $request, RequestContext $context): Response
    {
        $input = Input::fromRequest($request);
        $email = $input->email('email');
        $password = $input->string('password', Passwords::MAX_LENGTH);

        $throttle = ($this->throttle)();
        $throttle->assertAllowed($email, $request->clientIp);

        $accounts = ($this->accounts)();
        $account = $accounts->findByEmail($email);
        $valid = Passwords::verify($password, $account['password_hash'] ?? null) && $account['status'] === 'active';
        $throttle->record($email, $request->clientIp, $valid);
        if (!$valid) {
            throw new HttpException(401, 'invalid_credentials', 'Invalid e-mail or password.');
        }

        if (Passwords::needsRehash((string) $account['password_hash'])) {
            $accounts->setPassword($account['id'], Passwords::hash($password));
        }
        $accounts->recordLogin($account['id']);

        // always a brand-new session; a session the browser still had is ended
        $sessions = ($this->sessions)();
        $previous = $request->cookie($this->cookie->name);
        if ($previous !== null && $previous !== '' && ($old = $sessions->findByToken($previous)) !== null) {
            $sessions->destroy($old->id);
        }
        ['token' => $token, 'session' => $session] = $sessions->create($account['id'], $request->header('user-agent'));

        return Response::json($this->mePayload($session))
            ->withCookie($this->cookie->issue($token, $this->sessionLifetime));
    }

    private function logout(Request $request, RequestContext $context): Response
    {
        ($this->sessions)()->destroy(self::session($context)->id);

        return Response::noContent()->withCookie($this->cookie->clear());
    }

    private function me(Request $request, RequestContext $context): Response
    {
        return Response::json($this->mePayload(self::session($context)));
    }

    private function changePassword(Request $request, RequestContext $context): Response
    {
        $session = self::session($context);
        $input = Input::fromRequest($request);
        $current = $input->string('currentPassword', Passwords::MAX_LENGTH);
        $new = $input->string('newPassword', Passwords::MAX_LENGTH);

        $accounts = ($this->accounts)();
        $account = $accounts->findById($session->accountId);
        if ($account === null || !Passwords::verify($current, $account['password_hash'])) {
            throw Input::invalid('currentPassword', 'password_incorrect');
        }
        Passwords::assertAcceptable('newPassword', $new);

        $accounts->setPassword($session->accountId, Passwords::hash($new));
        ($this->sessions)()->destroyOthersForAccount($session->accountId, $session->id);

        return Response::noContent();
    }

    private function requestReset(Request $request, RequestContext $context): Response
    {
        ($this->resets)()->request(Input::fromRequest($request)->email('email'));

        return Response::noContent();
    }

    private function confirmReset(Request $request, RequestContext $context): Response
    {
        $input = Input::fromRequest($request);
        $token = $input->string('token', 100);
        $password = $input->string('password', Passwords::MAX_LENGTH);
        Passwords::assertAcceptable('password', $password);

        $accountId = ($this->resets)()->confirm($token, $password);
        if ($accountId === null) {
            throw new HttpException(422, 'reset_token_invalid', 'The link is invalid or has expired.');
        }
        ($this->sessions)()->destroyAllForAccount($accountId);

        return Response::noContent();
    }

    private function listSessions(Request $request, RequestContext $context): Response
    {
        $session = self::session($context);
        $items = array_map(
            static fn (array $item): array => $item + ['current' => $item['id'] === $session->id],
            ($this->sessions)()->listForAccount($session->accountId),
        );

        return Response::json(['items' => $items]);
    }

    private function deleteSession(Request $request, RequestContext $context): Response
    {
        $session = self::session($context);
        $id = filter_var($context->params['id'], FILTER_VALIDATE_INT);
        if ($id === false || !($this->sessions)()->destroyForAccount($id, $session->accountId)) {
            throw new HttpException(404, 'not_found', 'Not found.');
        }

        $response = Response::noContent();

        return $id === $session->id ? $response->withCookie($this->cookie->clear()) : $response;
    }

    /** @return array<string, mixed> */
    private function mePayload(Session $session): array
    {
        return ($this->accounts)()->profile($session->accountId) + ['csrfToken' => $session->csrfToken];
    }

    private static function session(RequestContext $context): Session
    {
        return $context->session ?? throw new \LogicException('Route requires a session');
    }
}
