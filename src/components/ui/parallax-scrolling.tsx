import React, { useEffect, useRef } from 'react';

interface ParallaxComponentProps {
  className?: string;
}

export function ParallaxComponent({ className = '' }: ParallaxComponentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return undefined;

    let frame: number | null = null;
    const paint = () => {
      frame = null;
      const rect = root.getBoundingClientRect();
      const scrollProgress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      const transforms = [
        `translate3d(0, ${scrollProgress * 82}px, 0) scale(1.12)`,
        `translate3d(0, ${scrollProgress * 58}px, 0) scale(1.12)`,
        `translate3d(0, ${scrollProgress * 18}px, 0) scale(1.12)`,
      ];

      layerRefs.current.forEach((layer, index) => {
        if (layer) layer.style.transform = transforms[index];
      });

    };

    const schedulePaint = () => {
      if (frame === null) frame = requestAnimationFrame(paint);
    };

    window.addEventListener('scroll', schedulePaint, { passive: true });
    window.addEventListener('resize', schedulePaint);
    schedulePaint();

    return () => {
      window.removeEventListener('scroll', schedulePaint);
      window.removeEventListener('resize', schedulePaint);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className={`lesson-parallax ${className}`} aria-hidden="true">
      <img
        ref={(node) => { layerRefs.current[0] = node; }}
        src="/images/lesson1-parallax/layer-back.webp"
        alt=""
        className="lesson-parallax__base"
      />
      <img
        ref={(node) => { layerRefs.current[1] = node; }}
        src="/images/lesson1-parallax/layer-mid.webp"
        alt=""
        className="lesson-parallax__layer lesson-parallax__layer--mid"
      />
      <img
        ref={(node) => { layerRefs.current[2] = node; }}
        src="/images/lesson1-parallax/layer-front.webp"
        alt=""
        className="lesson-parallax__layer lesson-parallax__layer--front"
      />
      <div className="lesson-parallax__shade" />
    </div>
  );
}
