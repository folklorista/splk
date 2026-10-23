<?php

declare(strict_types=1);

namespace Splk\Api\Http;

/**
 * Minimal router: method + path pattern with {name} parameters (one path segment each).
 * Route options: "auth" (default true) requires a valid session, and for unsafe methods also the CSRF token.
 */
final class Router
{
    /** @var list<array{method: string, regex: string, handler: callable, options: array<string, mixed>}> */
    private array $routes = [];

    /** @param array<string, mixed> $options */
    public function add(string $method, string $pattern, callable $handler, array $options = []): void
    {
        $regex = preg_replace('#\{([a-zA-Z][a-zA-Z0-9]*)\}#', '(?P<$1>[^/]+)', $pattern);
        $this->routes[] = [
            'method' => strtoupper($method),
            'regex' => '#^' . $regex . '$#',
            'handler' => $handler,
            'options' => $options + ['auth' => true],
        ];
    }

    /**
     * @return array{handler: callable, params: array<string, string>, options: array<string, mixed>}
     * @throws HttpException 404 for an unknown path, 405 for a known path with another method
     */
    public function match(string $method, string $path): array
    {
        $allowed = [];
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $path, $matches)) {
                continue;
            }
            if ($route['method'] !== $method) {
                $allowed[] = $route['method'];
                continue;
            }

            $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

            return ['handler' => $route['handler'], 'params' => array_map('rawurldecode', $params), 'options' => $route['options']];
        }

        if ($allowed !== []) {
            $allowed = array_values(array_unique([...$allowed, 'OPTIONS']));
            throw new HttpException(405, 'method_not_allowed', 'Method not allowed.', [], ['Allow' => implode(', ', $allowed)]);
        }

        throw new HttpException(404, 'not_found', 'Not found.');
    }
}
