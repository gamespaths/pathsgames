<?php

namespace Games\Paths\Core\Domain;

class GuestSession
{
    private string $uuid;
    private string $username;
    private string $cookieToken;
    private string $role;
    private int $state;
    private ?string $nickname;
    private ?string $language;
    private \DateTimeImmutable $tsInsert;
    private \DateTimeImmutable $expiresAt;
    private ?string $guestExpiresAt;
    private ?string $tsRegistration;
    private ?string $tsLastAccess;

    public function __construct(
        string $uuid,
        string $username,
        string $cookieToken,
        \DateTimeImmutable $tsInsert,
        \DateTimeImmutable $expiresAt,
        string $role = 'PLAYER',
        int $state = 6,
        ?string $nickname = null,
        ?string $language = null,
        ?string $guestExpiresAt = null,
        ?string $tsRegistration = null,
        ?string $tsLastAccess = null
    ) {
        $this->uuid = $uuid;
        $this->username = $username;
        $this->cookieToken = $cookieToken;
        $this->tsInsert = $tsInsert;
        $this->expiresAt = $expiresAt;
        $this->role = $role;
        $this->state = $state;
        $this->nickname = $nickname;
        $this->language = $language;
        $this->guestExpiresAt = $guestExpiresAt;
        $this->tsRegistration = $tsRegistration;
        $this->tsLastAccess = $tsLastAccess;
    }

    public function getUuid(): string { return $this->uuid; }
    public function getUsername(): string { return $this->username; }
    public function getCookieToken(): string { return $this->cookieToken; }
    public function getRole(): string { return $this->role; }
    public function getState(): int { return $this->state; }
    public function getNickname(): ?string { return $this->nickname; }
    public function getLanguage(): ?string { return $this->language; }
    public function getTsInsert(): \DateTimeImmutable { return $this->tsInsert; }
    public function getExpiresAt(): \DateTimeImmutable { return $this->expiresAt; }
    public function getGuestExpiresAt(): ?string { return $this->guestExpiresAt; }
    public function getTsRegistration(): ?string { return $this->tsRegistration; }
    public function getTsLastAccess(): ?string { return $this->tsLastAccess; }

    /**
     * Format for /api/admin/guests — matches Python GuestInfo model_dump(by_alias=True)
     */
    public function toAdminArray(): array
    {
        $expired = false;
        if ($this->guestExpiresAt) {
            try {
                $dt = new \DateTimeImmutable($this->guestExpiresAt);
                $expired = new \DateTimeImmutable() > $dt;
            } catch (\Exception $e) {
                $expired = false;
            }
        }

        return [
            'userUuid' => $this->uuid,
            'username' => $this->username,
            'nickname' => $this->nickname,
            'role' => $this->role,
            'state' => $this->state,
            'guestCookieToken' => $this->cookieToken,
            'guestExpiresAt' => $this->guestExpiresAt,
            'language' => $this->language,
            'tsRegistration' => $this->tsRegistration,
            'tsLastAccess' => $this->tsLastAccess,
            'expired' => $expired,
        ];
    }

    /**
     * Legacy format (kept for backward compat)
     */
    public function toArray(): array
    {
        return [
            'uuid' => $this->uuid,
            'guestCookieToken' => $this->cookieToken,
            'tsInsert' => $this->tsInsert->format(\DateTimeInterface::ATOM),
            'expiresAt' => $this->expiresAt->format(\DateTimeInterface::ATOM),
        ];
    }
}
