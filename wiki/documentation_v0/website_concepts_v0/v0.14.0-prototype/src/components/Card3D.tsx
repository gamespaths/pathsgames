/* =============================================
   Card3D — wrapper component for 3D tilt effect
   ============================================= */

import type { ReactNode } from 'react';
import { useCard3D } from '../hooks/useCard3D';

interface Card3DProps {
  children: ReactNode;
  className?: string;
}

export default function Card3D({ children, className = '' }: Card3DProps) {
  const { onMouseMove, onMouseLeave, ref } = useCard3D();

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`card-3d ${className}`}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div className="card-3d-shine" />
      {children}
    </div>
  );
}
