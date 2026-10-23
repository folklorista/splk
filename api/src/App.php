<?php

declare(strict_types=1);

namespace Splk\Api;

use Splk\Api\Auth\LoginThrottle;
use Splk\Api\Auth\PasswordResets;
use Splk\Api\Auth\Session;
use Splk\Api\Auth\SessionCookie;
use Splk\Api\Auth\SessionStore;
use Splk\Api\Domain\Identity\AccountRepository;
use Splk\Api\Http\Controller\AuthController;
use Splk\Api\Http\Controller\CatalogController;
use Splk\Api\Http\Controller\HealthController;
use Splk\Api\Http\Controller\ItemController;
use Splk\Api\Http\Controller\BulkStockController;
use Splk\Api\Http\Controller\KitController;
use Splk\Api\Http\Controller\WorkOrderController;
use Splk\Api\Http\Controller\OrganizationController;
use Splk\Api\Http\HttpException;
use Splk\Api\Http\Request;
use Splk\Api\Http\RequestContext;
use Splk\Api\Http\RequestPolicy;
use Splk\Api\Http\Response;
use Splk\Api\Http\Router;
use Splk\Api\Infrastructure\Db\Connection;
use Splk\Api\Infrastructure\Mail\LogMailer;
use Splk\Api\Infrastructure\Mail\Mailer;
use Splk\Api\Infrastructure\Mail\SmtpMailer;

/**
 * HTTP kernel: request policy (CORS, origin, JSON) → routing → session and CSRF for authenticated routes → handler.
 * Every error is rendered as JSON with a stable code; internal details go only to the error log.
 */
final class App
{
    private const DEFAULT_ABSOLUTE_LIFETIME = 30 * 24 * 3600;
    private const DEFAULT_IDLE_TIMEOUT = 14 * 24 * 3600;

    public readonly Router $router;
    public readonly Connection $db;
    public readonly SessionCookie $sessionCookie;
    public readonly int $sessionLifetime;
    private readonly RequestPolicy $policy;
    private ?SessionStore $sessions = null;
    private readonly int $idleTimeout;
    private ?Mailer $mailer;

    public function __construct(private readonly Config $config, ?Connection $db = null, ?Mailer $mailer = null)
    {
        $this->db = $db ?? new Connection((array) $config->get('db', []));
        $this->mailer = $mailer;
        $this->policy = new RequestPolicy(array_values((array) $config->get('cors.allowedOrigins', [])));
        $this->sessionCookie = new SessionCookie(
            (string) $config->get('session.cookieName', '__Host-vonica_sid'),
            (bool) $config->get('session.cookieSecure', true),
        );
        $this->sessionLifetime = (int) $config->get('session.absoluteLifetime', self::DEFAULT_ABSOLUTE_LIFETIME);
        $this->idleTimeout = (int) $config->get('session.idleTimeout', self::DEFAULT_IDLE_TIMEOUT);

        $this->router = new Router();
        $this->registerRoutes(self::readVersion());
    }

    public function sessions(): SessionStore
    {
        return $this->sessions ??= new SessionStore($this->db->pdo(), $this->sessionLifetime, $this->idleTimeout);
    }

    public function mailer(): Mailer
    {
        return $this->mailer ??= match ($this->config->get('mail.transport', 'smtp')) {
            'log' => new LogMailer(),
            default => new SmtpMailer((array) $this->config->get('mail', [])),
        };
    }

    public function handle(Request $request): Response
    {
        try {
            $this->policy->check($request);
            $response = $this->policy->isPreflight($request)
                ? $this->policy->preflightResponse()
                : $this->dispatch($request);
        } catch (HttpException $e) {
            $response = $e->toResponse();
        } catch (\Throwable $e) {
            error_log((string) $e);
            $response = (new HttpException(500, 'internal_error', 'Internal server error.'))->toResponse();
        }

        return $this->policy->decorate($request, $response);
    }

    private function dispatch(Request $request): Response
    {
        $route = $this->router->match($request->method, $request->path);

        $session = null;
        if ($route['options']['auth']) {
            $session = $this->resolveSession($request);
            if (!$request->isSafeMethod() && !$session->isValidCsrfToken($request->header('x-csrf-token'))) {
                throw new HttpException(403, 'csrf_token_invalid', 'Missing or invalid CSRF token.');
            }
        }

        return ($route['handler'])($request, new RequestContext($route['params'], $session));
    }

    private function resolveSession(Request $request): Session
    {
        $token = $request->cookie($this->sessionCookie->name);
        $session = $token === null || $token === '' ? null : $this->sessions()->findByToken($token);
        if ($session === null) {
            throw new HttpException(401, 'unauthenticated', 'Authentication required.');
        }

        return $session;
    }

    private function registerRoutes(string $version): void
    {
        $this->router->add('GET', '/v1/health', new HealthController($this->db, $version), ['auth' => false]);

        $accounts = fn (): AccountRepository => new AccountRepository($this->db->pdo());
        $passwordLinks = fn (): PasswordResets => new PasswordResets(
            $this->db->pdo(),
            $accounts(),
            $this->mailer(),
            (string) $this->config->get('app.krojarkaUrl', 'https://krojarka.vonica.cz'),
        );
        (new AuthController(
            $accounts,
            $this->sessions(...),
            fn (): LoginThrottle => new LoginThrottle($this->db->pdo()),
            $passwordLinks,
            $this->sessionCookie,
            $this->sessionLifetime,
        ))->register($this->router);

        (new CatalogController($this->db->pdo(...)))->register($this->router);
        (new ItemController($this->db->pdo(...)))->register($this->router);
        (new BulkStockController($this->db->pdo(...)))->register($this->router);
        (new KitController($this->db->pdo(...)))->register($this->router);
        (new WorkOrderController($this->db->pdo(...)))->register($this->router);
        (new OrganizationController($this->db->pdo(...), $passwordLinks, $this->sessions(...)))->register($this->router);
    }

    /** Version written to build-info.json by deploy; "dev" in a working copy. */
    private static function readVersion(): string
    {
        $file = dirname(__DIR__) . '/build-info.json';
        $info = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;

        return is_array($info) && is_string($info['version'] ?? null) ? $info['version'] : 'dev';
    }
}
