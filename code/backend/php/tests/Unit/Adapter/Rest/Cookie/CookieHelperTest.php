<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest\Cookie;

use Games\Paths\Adapter\Rest\Cookie\CookieHelper;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;

class CookieHelperTest extends TestCase
{
    public function testSetCookie(): void
    {
        $response = (new ResponseFactory())->createResponse();
        $newResponse = CookieHelper::setCookie($response, 'test_cookie', 'test_value', 3600);

        $cookieHeader = $newResponse->getHeaderLine('Set-Cookie');
        $this->assertStringContainsString('test_cookie=test_value', $cookieHeader);
        $this->assertStringContainsString('Max-Age=3600', $cookieHeader);
        $this->assertStringContainsString('HttpOnly', $cookieHeader);
        $this->assertStringContainsString('SameSite=None', $cookieHeader);
        $this->assertStringContainsString('Secure', $cookieHeader);
    }

    public function testSetCookieNoMaxAge(): void
    {
        $response = (new ResponseFactory())->createResponse();
        $newResponse = CookieHelper::setCookie($response, 'test_cookie', 'test_value');

        $cookieHeader = $newResponse->getHeaderLine('Set-Cookie');
        $this->assertStringContainsString('test_cookie=test_value', $cookieHeader);
        $this->assertStringNotContainsString('Max-Age', $cookieHeader);
    }

    public function testClearCookie(): void
    {
        $response = (new ResponseFactory())->createResponse();
        $newResponse = CookieHelper::clearCookie($response, 'test_cookie');

        $cookieHeader = $newResponse->getHeaderLine('Set-Cookie');
        $this->assertStringContainsString('test_cookie=;', $cookieHeader);
        $this->assertStringContainsString('Max-Age=-1', $cookieHeader);
    }
}
