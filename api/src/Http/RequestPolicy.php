<?php

declare(strict_types=1);

namespace Splk\Api\Http;

/**
 * CORS and the request-level protection layers from hosting doc chap. 4 and 7 (D-12):
 * origin allowlist, Sec-Fetch-Site, JSON-only writes. The CSRF token is checked per route in App.
 */
final class RequestPolicy
{
    private const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
    private const ALLOWED_HEADERS = 'Content-Type, X-CSRF-Token';

    /** @param list<string> $allowedOrigins exact origins, e.g. https://krojarka.vonica.cz */
    public function __construct(private readonly array $allowedOrigins)
    {
    }

    /** @throws HttpException when the request must be rejected before routing */
    public function check(Request $request): void
    {
        $origin = $request->header('origin');
        if ($origin !== null && !$this->isAllowedOrigin($origin)) {
            throw new HttpException(403, 'origin_not_allowed', 'Origin is not allowed.');
        }

        if ($request->isSafeMethod()) {
            return;
        }

        // Browsers always send Origin with fetch/POST; a write without it is not from our frontends.
        if ($origin === null) {
            throw new HttpException(403, 'origin_required', 'Origin header is required.');
        }
        if ($request->header('sec-fetch-site') === 'cross-site') {
            throw new HttpException(403, 'cross_site_request', 'Cross-site requests are not allowed.');
        }
        if (trim($request->body) !== '' && $request->mediaType() !== 'application/json') {
            throw new HttpException(415, 'unsupported_media_type', 'Request body must be application/json.');
        }
    }

    public function isPreflight(Request $request): bool
    {
        return $request->method === 'OPTIONS';
    }

    public function preflightResponse(): Response
    {
        return Response::noContent()
            ->withHeader('Access-Control-Allow-Methods', self::ALLOWED_METHODS)
            ->withHeader('Access-Control-Allow-Headers', self::ALLOWED_HEADERS)
            ->withHeader('Access-Control-Max-Age', '600');
    }

    /** Adds CORS headers for an allowed origin and the headers every API response carries. */
    public function decorate(Request $request, Response $response): Response
    {
        $response = $response
            ->withHeader('Cache-Control', 'no-store')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Strict-Transport-Security', 'max-age=31536000')
            ->withHeader('Vary', 'Origin');

        $origin = $request->header('origin');
        if ($origin !== null && $this->isAllowedOrigin($origin)) {
            $response = $response
                ->withHeader('Access-Control-Allow-Origin', $origin)
                ->withHeader('Access-Control-Allow-Credentials', 'true');
        }

        return $response;
    }

    private function isAllowedOrigin(string $origin): bool
    {
        return in_array($origin, $this->allowedOrigins, true);
    }
}
