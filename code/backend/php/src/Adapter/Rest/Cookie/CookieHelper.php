<?php

namespace Games\Paths\Adapter\Rest\Cookie;

use Psr\Http\Message\ResponseInterface;

/**
 * Utility for managing HttpOnly cookies in Slim responses.
 */
class CookieHelper
{
    private const SECURE = true; // Set to true in production (HTTPS) or develop on localhost
    private const SAME_SITE = 'None';

    /**
     * Sets a cookie on the response.
     */
    public static function setCookie(
        ResponseInterface $response,
        string $name,
        string $value,
        int $maxAge = 0,
        string $path = '/'
    ): ResponseInterface {
        $cookie = sprintf(
            '%s=%s; Path=%s; HttpOnly; SameSite=%s',
            $name,
            $value,
            $path,
            self::SAME_SITE
        );

        if ($maxAge !== 0) {
            $cookie .= "; Max-Age=$maxAge";
        }

        if (self::SECURE) {
            $cookie .= '; Secure';
        }

        return $response->withAddedHeader('Set-Cookie', $cookie);
    }

    /**
     * Clears a cookie by setting its Max-Age to 0.
     */
    public static function clearCookie(ResponseInterface $response, string $name, string $path = '/'): ResponseInterface
    {
        return self::setCookie($response, $name, '', -1, $path);
    }
}
