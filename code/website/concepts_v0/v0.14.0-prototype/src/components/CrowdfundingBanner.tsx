/* =============================================
   CrowdfundingBanner — parchment-themed banner
   ============================================= */

import BadgeCarousel from './BadgeCarousel';

export default function CrowdfundingBanner() {
  return (
    <section className="crowdfund-banner">
      <h2 className="crowdfund-title">
        <i className="fas fa-scroll me-2" />
        Crowdfunding Coming Soon
      </h2>
      <p className="crowdfund-divider">— ✦ ⚜ ✦ —</p>
      <p className="crowdfund-desc">
        <strong>Paths Games</strong> is a multiplayer gamebook platform where every choice shapes the
        world. Explore branching stories, forge alliances, and discover multiple endings.
        Support us on crowdfunding to bring this vision to life!
      </p>
      <div className="mt-4 flex justify-center items-center gap-2 flex-wrap">
        <BadgeCarousel />
      </div>
    </section>
  );
}
