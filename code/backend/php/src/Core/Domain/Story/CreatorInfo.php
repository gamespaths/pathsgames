<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class CreatorInfo implements \JsonSerializable
{
    public function __construct(
        public string $uuid,
        public ?string $name = null,
        public ?string $link = null,
        public ?string $url = null,
        public ?string $urlImage = null,
        public ?string $urlEmote = null,
        public ?string $urlInstagram = null
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'uuid' => $this->uuid,
            'name' => $this->name,
            'link' => $this->link,
            'url' => $this->url,
            'urlImage' => $this->urlImage,
            'urlEmote' => $this->urlEmote,
            'urlInstagram' => $this->urlInstagram,
        ];
    }
}
