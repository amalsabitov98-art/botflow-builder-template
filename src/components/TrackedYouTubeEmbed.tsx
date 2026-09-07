import React, { useEffect, useMemo, useRef } from 'react';

interface TrackedYouTubeEmbedProps {
  src: string;
  title?: string;
  className?: string;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __youtubeApiReady?: Promise<void>;
  }
}

function loadYouTubeApi() {
  if (window.__youtubeApiReady) return window.__youtubeApiReady;

  window.__youtubeApiReady = new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });

  return window.__youtubeApiReady;
}

function withTrackingParams(src: string, playerId: string) {
  let url: URL;
  try {
    url = new URL(src, window.location.href);
  } catch {
    url = new URL('https://www.youtube.com/embed/S2pEicQ1760');
  }
  const hostname = url.hostname.toLowerCase();
  const isAllowedYouTubeHost = hostname === 'youtube.com'
    || hostname.endsWith('.youtube.com')
    || hostname === 'youtube-nocookie.com'
    || hostname.endsWith('.youtube-nocookie.com');
  if (url.protocol !== 'https:' || !isAllowedYouTubeHost) {
    url = new URL('https://www.youtube.com/embed/S2pEicQ1760');
  }
  url.searchParams.set('enablejsapi', '1');
  url.searchParams.set('playsinline', '1');
  url.searchParams.set('origin', window.location.origin);
  url.searchParams.set('widget_referrer', window.location.href);
  return `${url.toString()}#${playerId}`;
}

export default function TrackedYouTubeEmbed({ src, title = 'Урок', className }: TrackedYouTubeEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sentRef = useRef(false);
  const playerId = useMemo(() => `yt-player-${Math.random().toString(36).slice(2, 10)}`, []);
  const trackedSrc = useMemo(() => withTrackingParams(src, playerId), [src, playerId]);

  useEffect(() => {
    let player: any = null;
    let interval: number | null = null;
    let destroyed = false;
    let playedSeconds = 0;

    const stopPolling = () => {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    const sendViewed = () => {
      if (sentRef.current) return;
      sentRef.current = true;
      window.dispatchEvent(new CustomEvent('lesson-video-viewed'));
    };

    void loadYouTubeApi().then(() => {
      if (destroyed || !iframeRef.current || !window.YT?.Player) return;

      player = new window.YT.Player(iframeRef.current, {
        events: {
          onStateChange: (event: any) => {
            const playing = event.data === window.YT.PlayerState.PLAYING;
            if (!playing) {
              stopPolling();
              return;
            }

            if (interval !== null) return;
            interval = window.setInterval(() => {
              const duration = Number(player?.getDuration?.() || 0);
              const currentTime = Number(player?.getCurrentTime?.() || 0);
              if (!duration || !currentTime) return;

              playedSeconds += 1;
              const watchedRatio = currentTime / duration;
              const enoughPlayback = playedSeconds >= Math.min(45, Math.max(15, duration * 0.35));

              if (watchedRatio >= 0.75 && enoughPlayback) {
                sendViewed();
                stopPolling();
              }
            }, 1000);
          },
        },
      });
    }).catch((error) => console.error('Failed to initialize YouTube tracking:', error));

    return () => {
      destroyed = true;
      stopPolling();
      try {
        player?.destroy?.();
      } catch {
        // YouTube may already have removed the iframe during route changes.
      }
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      id={playerId}
      src={trackedSrc}
      title={title}
      className={className || 'absolute inset-0 w-full h-full border-none opacity-90'}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}
