import type { PrismaClient } from '@prisma/client';
import { resolveText } from '../../adapters/persistence/prisma/textResolver';

export class ContentQueryService {
  constructor(private prisma: PrismaClient) {}

  private async _creatorObj(idStory: number, idCreator: number | null | undefined, lang: string) {
    if (idCreator == null) return null;
    const cr = await this.prisma.creator.findFirst({ where: { idStory, id: idCreator } });
    if (!cr) return null;
    return {
      uuid: cr.uuid,
      name: (await resolveText(this.prisma, idStory, cr.idText, lang)) ?? cr.link ?? null,
      link: cr.link ?? null,
      url: cr.url ?? null,
      urlImage: cr.urlImage ?? null,
      urlEmote: cr.urlEmote ?? null,
      urlInstagram: cr.urlInstagram ?? null,
    };
  }

  async getCardInfo(storyUuid: string, cardUuid: string, lang = 'en') {
    const story = await this.prisma.listStory.findUnique({ where: { uuid: storyUuid } });
    if (!story) return { error: 'STORY_NOT_FOUND', message: `Story not found: ${storyUuid}`, status: 404 };

    const card = await this.prisma.card.findUnique({ where: { uuid: cardUuid } });
    if (!card || card.idStory !== story.id) {
      return { error: 'CARD_NOT_FOUND', message: `Card not found: ${cardUuid}`, status: 404 };
    }

    return {
      data: {
        uuid: card.uuid,
        cardType: card.cardType ?? null,
        urlImage: card.urlImmage ?? null,
        alternativeImage: card.alternativeImage ?? null,
        awesomeIcon: card.awesomeIcon ?? null,
        styleMain: card.styleMain ?? null,
        styleDetail: card.styleDetail ?? null,
        styleImageLittle: card.styleImageLittle ?? null,
        styleImageMedium: card.styleImageMedium ?? null,
        styleImageLarge: card.styleImageLarge ?? null,
        title: (await resolveText(this.prisma, story.id, card.idTextTitle, lang)) ?? null,
        description: (await resolveText(this.prisma, story.id, card.idTextDescription, lang)) ?? null,
        copyrightText: (await resolveText(this.prisma, story.id, card.idTextCopyright, lang)) ?? null,
        linkCopyright: card.linkCopyright ?? null,
        creator: await this._creatorObj(story.id, card.idCreator, lang),
      },
    };
  }

  async getTextInfo(storyUuid: string, idText: number, lang: string) {
    const story = await this.prisma.listStory.findUnique({ where: { uuid: storyUuid } });
    // Unknown story ⇒ the text cannot exist either: report TEXT_NOT_FOUND (contract parity).
    if (!story) return { error: 'TEXT_NOT_FOUND', message: `Text not found: ${idText}`, status: 404 };

    let text = await this.prisma.storyText.findUnique({
      where: { idStory_idText_lang: { idStory: story.id, idText, lang } },
    });
    let resolvedLang = lang;

    if (!text && lang !== 'en') {
      text = await this.prisma.storyText.findUnique({
        where: { idStory_idText_lang: { idStory: story.id, idText, lang: 'en' } },
      });
      resolvedLang = 'en';
    }
    if (!text) {
      text = await this.prisma.storyText.findFirst({ where: { idStory: story.id, idText } });
      if (text) resolvedLang = text.lang;
    }
    if (!text) {
      return { error: 'TEXT_NOT_FOUND', message: `Text not found: idText=${idText}`, status: 404 };
    }

    return {
      data: {
        idText: text.idText,
        lang,
        resolvedLang,
        shortText: text.shortText || null,
        longText: text.longText || null,
        copyrightText: null,
        creator: null,
      },
    };
  }

  async getCreatorInfo(storyUuid: string, creatorUuid: string, lang = 'en') {
    const story = await this.prisma.listStory.findUnique({ where: { uuid: storyUuid } });
    if (!story) return { error: 'STORY_NOT_FOUND', message: `Story not found: ${storyUuid}`, status: 404 };

    const creator = await this.prisma.creator.findUnique({ where: { uuid: creatorUuid } });
    if (!creator || creator.idStory !== story.id) {
      return { error: 'CREATOR_NOT_FOUND', message: `Creator not found: ${creatorUuid}`, status: 404 };
    }

    return {
      data: {
        uuid: creator.uuid,
        name: (await resolveText(this.prisma, story.id, creator.idText, lang)) ?? creator.link ?? null,
        link: creator.link ?? null,
        url: creator.url ?? null,
        urlImage: creator.urlImage ?? null,
        urlEmote: creator.urlEmote ?? null,
        urlInstagram: creator.urlInstagram ?? null,
      },
    };
  }
}
