<?php

namespace Games\Paths\Core\Domain\Matches;

/**
 * MatchTraitCodec — converts the match trait-uuid selection between the
 * domain representation (a list of strings) and the comma-separated string
 * persisted in gaming_match.trait_uuids. Step 0.19.9.
 */
final class MatchTraitCodec
{
    /**
     * Join trait uuids into a comma-separated string. Blank entries are
     * dropped; an empty or null input yields null.
     *
     * @param string[]|null $traitUuids
     */
    public static function join(?array $traitUuids): ?string
    {
        if (empty($traitUuids)) {
            return null;
        }
        $cleaned = [];
        foreach ($traitUuids as $trait) {
            $trimmed = trim((string)$trait);
            if ($trimmed !== '') {
                $cleaned[] = $trimmed;
            }
        }
        return empty($cleaned) ? null : implode(',', $cleaned);
    }

    /**
     * Split a comma-separated string into trait uuids. A blank or null
     * input yields an empty list.
     *
     * @return string[]
     */
    public static function split(?string $csv): array
    {
        $result = [];
        if ($csv === null || trim($csv) === '') {
            return $result;
        }
        foreach (explode(',', $csv) as $part) {
            $trimmed = trim($part);
            if ($trimmed !== '') {
                $result[] = $trimmed;
            }
        }
        return $result;
    }
}
