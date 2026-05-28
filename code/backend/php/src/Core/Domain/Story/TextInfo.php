<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class TextInfo implements \JsonSerializable
{
    public function __construct(
        public int $idText,
        public string $lang,
        public string $resolvedLang,
        public ?string $shortText = null,
        public ?string $longText = null,
        public ?string $copyrightText = null,
        public ?string $linkCopyright = null,
        public ?CreatorInfo $creator = null
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'idText' => $this->idText,
            'lang' => $this->lang,
            'resolvedLang' => $this->resolvedLang,
            'shortText' => $this->shortText,
            'longText' => $this->longText,
            'copyrightText' => $this->copyrightText,
            'linkCopyright' => $this->linkCopyright,
            'creator' => $this->creator,
        ];
    }
}
