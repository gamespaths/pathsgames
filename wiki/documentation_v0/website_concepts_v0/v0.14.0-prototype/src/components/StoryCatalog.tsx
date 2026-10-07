/* =============================================
   StoryCatalog — groups stories by category
   and renders StoryRow per category
   ============================================= */

import { useMemo } from 'react';
import { STORIES } from '../data/stories';
import StoryRow from './StoryRow';

export default function StoryCatalog() {
  const categorized = useMemo(() => {
    const map: Record<string, typeof STORIES> = {};
    STORIES.forEach((s) => {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    });
    return Object.entries(map);
  }, []);

  return (
    <section className="px-4 py-6 max-w-7xl mx-auto">
      {categorized.map(([category, stories]) => (
        <StoryRow key={category} category={category} stories={stories} />
      ))}
    </section>
  );
}
