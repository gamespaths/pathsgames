/* =============================================
   BadgeCarousel — rotating badge display
   Ported from main.js badge carousel logic
   ============================================= */

import { useState, useEffect } from 'react';

const BADGES = [
  'Free to Play',
  'Gamebook RPG',
  'Branching Stories',
  'Multiple Paths',
  'Multiplayer',
  'Crowdfunding',
  'Open Source Code',
];

export default function BadgeCarousel() {
  const [index, setIndex] = useState(0);
  const [animClass, setAnimClass] = useState('badge-enter');

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimClass('badge-exit');
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % BADGES.length);
        setAnimClass('badge-enter');
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={`crowdfund-badge ${animClass}`}>
      {BADGES[index]}
    </span>
  );
}
