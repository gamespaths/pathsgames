/* =============================================
   useCard3D — 3D perspective tilt on hover
   Ported from main.js card tilt logic
   ============================================= */

import { useCallback, useRef, type CSSProperties } from 'react';

interface Card3DHandlers {
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  ref: React.RefObject<HTMLElement | null>;
  shineStyle: CSSProperties;
}

export function useCard3D(): Card3DHandlers {
  const ref = useRef<HTMLElement | null>(null);
  const shineRef = useRef<CSSProperties>({});

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const rotateY = ((x - cx) / cx) * 15;
    const rotateX = ((cy - y) / cy) * 10;

    el.style.transform = `perspective(600px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;

    const pctX = (x / rect.width) * 100;
    const pctY = (y / rect.height) * 100;
    shineRef.current = {
      background: `radial-gradient(circle at ${pctX}% ${pctY}%, rgba(255,215,0,0.15), transparent 60%)`,
      opacity: 1,
    };

    // Update shine element if present
    const shine = el.querySelector('.card-3d-shine') as HTMLElement | null;
    if (shine) {
      shine.style.background = shineRef.current.background as string;
      shine.style.opacity = '1';
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg)';
    const shine = el.querySelector('.card-3d-shine') as HTMLElement | null;
    if (shine) {
      shine.style.opacity = '0';
    }
  }, []);

  return {
    onMouseMove,
    onMouseLeave,
    ref,
    shineStyle: shineRef.current,
  };
}
