/* =============================================
   StoryRow — Netflix-style horizontal scroll row
   with drag-to-scroll support
   ============================================= */

import { useRef, useCallback } from 'react';
import type { Story } from '../types';
import StoryCard from './StoryCard';

interface StoryRowProps {
  category: string;
  stories: Story[];
}

export default function StoryRow({ category, stories }: StoryRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = rowRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
  }, []);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    if (rowRef.current) rowRef.current.style.cursor = 'grab';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !rowRef.current) return;
    e.preventDefault();
    const x = e.pageX - rowRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    rowRef.current.scrollLeft = scrollLeft.current - walk;
  }, []);

  return (
    <div className="mb-4">
      <h3 className="catalog-cat-title">{category}</h3>
      <div
        ref={rowRef}
        className="catalog-row"
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseMove={onMouseMove}
      >
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </div>
  );
}
