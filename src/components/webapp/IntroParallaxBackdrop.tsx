import React from 'react';

export default function IntroParallaxBackdrop() {
  return (
    <div className="intro-parallax-backdrop" aria-hidden="true">
      <img
        src="/images/intro-parallax/intro-parallax-bg.webp"
        alt=""
        className="intro-parallax-backdrop__base"
      />
      <img
        src="/images/intro-parallax/intro-parallax-left.webp"
        alt=""
        className="intro-parallax-backdrop__layer intro-parallax-backdrop__layer--left"
      />
      <img
        src="/images/intro-parallax/intro-parallax-right.webp"
        alt=""
        className="intro-parallax-backdrop__layer intro-parallax-backdrop__layer--right"
      />
      <img
        src="/images/intro-parallax/intro-parallax-fog.webp"
        alt=""
        className="intro-parallax-backdrop__fog"
      />
      <div className="intro-parallax-backdrop__veil" />
    </div>
  );
}
