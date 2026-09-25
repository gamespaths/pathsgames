/* =============================================
   HomePage — Crowdfunding banner + Story catalog
   ============================================= */

import CrowdfundingBanner from '../components/CrowdfundingBanner';
import StoryCatalog from '../components/StoryCatalog';
import StoryPreviewModal from '../components/StoryPreviewModal';

export default function HomePage() {
  return (
    <>
      <CrowdfundingBanner />
      <StoryCatalog />
      <StoryPreviewModal />
    </>
  );
}
