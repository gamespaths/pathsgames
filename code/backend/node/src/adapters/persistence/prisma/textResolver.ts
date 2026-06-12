import type { PrismaClient } from '@prisma/client';

/**
 * Resolve a text reference (id_text) to its shortText for a story, with lang
 * fallback to 'en' and then any lang. Returns null when not resolvable.
 * Mirrors the runtime resolution of id_text_* columns against list_texts.
 */
export async function resolveText(
  prisma: PrismaClient,
  idStory: number,
  idText: number | null | undefined,
  lang = 'en',
): Promise<string | null> {
  if (idText == null) return null;
  const row =
    (await prisma.storyText.findUnique({
      where: { idStory_idText_lang: { idStory, idText, lang } },
    })) ??
    (lang !== 'en'
      ? await prisma.storyText.findUnique({
          where: { idStory_idText_lang: { idStory, idText, lang: 'en' } },
        })
      : null) ??
    (await prisma.storyText.findFirst({ where: { idStory, idText } }));
  return row?.shortText ?? null;
}

/** Best-effort parse of a string id ("12") to an int; NaN-safe. */
export function toInt(id: string | number | null | undefined): number {
  if (typeof id === 'number') return id;
  const n = parseInt(String(id ?? ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Parse a `ts_*` string column to a Date, falling back to now(). */
export function toDate(ts: string | null | undefined): Date {
  if (!ts) return new Date();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
