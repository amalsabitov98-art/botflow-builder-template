import React, { useEffect, useRef, useState } from 'react';

export interface HeroProps {
  trustBadge?: {
    text: string;
    icons?: string[];
  };
  headline?: {
    line1: string;
    line2?: string;
  };
  subtitle?: string;
  buttons?: {
    primary?: {
      text: string;
      onClick?: () => void;
    };
    secondary?: {
      text: string;
      onClick?: () => void;
    };
  };
  className?: string;
  children?: React.ReactNode;
}

/**
 * Высокопроизводительный WebGL шейдерный фон.
 * Рисует плавные космические флюидные волны (Aurora / Nebula Fluid Flow)
 * с интерактивной реакцией на движение мыши.
 */
export const ShaderBackground: React.FC<{ className?: string }> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'high-performance',
    });

    if (!gl) return;

    // Вершинный шейдер (полноэкранный квад)
    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Фрагментный шейдер: живая флюидная плазма / космическая аврора (Fluid Mesh Gradient Flow)
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float t = u_time * 0.35;

        // Органические волновые вихри
        for (float i = 1.0; i < 4.0; i++) {
          p.x += 0.35 / i * sin(i * 2.5 * p.y + t * 0.8 + 0.4 * i) + 0.15;
          p.y += 0.35 / i * cos(i * 2.5 * p.x + t * 0.8 + 0.4 * i) + 0.1;
        }


        // Интерактивная реакция на мышь
        vec2 m = (u_mouse.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float mouseDist = length(p - m);
        float mouseEffect = smoothstep(0.9, 0.0, mouseDist) * 0.35;

        // Премиальная космическая палитра (Индиго, Нео-Фиолет, Розовая туманность, Глубокий ультрамарин)
        vec3 deepSpace = vec3(0.04, 0.04, 0.09);
        vec3 violetGlow = vec3(0.38, 0.14, 0.68);
        vec3 indigoGlow = vec3(0.12, 0.32, 0.78);
        vec3 roseNebula = vec3(0.85, 0.28, 0.58);
        vec3 cyanShimmer = vec3(0.15, 0.75, 0.85);

        float wave1 = sin(p.x * 2.2 + t * 0.6) * cos(p.y * 2.0 - t * 0.4);
        float wave2 = sin(p.y * 2.8 + t * 0.5) * cos(p.x * 1.8 + t * 0.3);

        vec3 col = mix(deepSpace, violetGlow, clamp(wave1 * 0.6 + 0.5, 0.0, 1.0));
        col = mix(col, indigoGlow, clamp(wave2 * 0.5 + 0.5 + mouseEffect, 0.0, 1.0));
        col += roseNebula * pow(max(0.0, sin(p.x * 1.5 + p.y * 1.2 + t * 0.7)), 3.2) * 0.65;
        col += cyanShimmer * pow(max(0.0, cos(p.x * 2.0 - p.y * 1.5 + t * 0.9)), 4.0) * 0.35;

        // Мягкое затемнение к краям для идеальной читаемости любого текста
        vec2 screenUv = gl_FragCoord.xy / u_resolution.xy;
        float vignette = 1.0 - smoothstep(0.4, 1.4, length(screenUv - 0.5) * 1.5);
        col *= (0.75 + 0.25 * vignette);

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = createShader(gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    gl.useProgram(program);

    // Геометрия на весь экран
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    );

    const posAttr = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');

    let currentMouse = { x: 0, y: 0 };
    let targetMouse = { x: 0, y: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouse = {
        x: (e.clientX - rect.left) * Math.min(window.devicePixelRatio, 1.5),
        y: (rect.height - (e.clientY - rect.top)) * Math.min(window.devicePixelRatio, 1.5),
      };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    let animationFrameId: number;
    let startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const clientW = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const clientH = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
      const displayWidth = Math.max(1, Math.round(clientW * dpr));
      const displayHeight = Math.max(1, Math.round(clientH * dpr));

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };

    resize();

    const render = () => {
      resize();

      const time = (performance.now() - startTime) * 0.001;
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.05;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.05;

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, currentMouse.x, currentMouse.y);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (program) gl.deleteProgram(program);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full pointer-events-none ${className}`}
      style={{ filter: 'contrast(1.05)' }}
    />
  );
};

/**
 * Animated Shader Hero Component
 * Полностью совместимый со спецификацией 21st.dev / Animated Shader Hero
 */
export const Hero: React.FC<HeroProps> = ({
  trustBadge,
  headline,
  subtitle,
  buttons,
  className = '',
  children,
}) => {
  return (
    <section className={`relative min-h-[640px] w-full flex items-center justify-center overflow-hidden bg-[#07070c] px-4 py-20 text-white ${className}`}>
      {/* WebGL Шейдерный интерактивный фон */}
      <ShaderBackground />

      {/* Мягкая радиальная подсветка для идеального контраста контента */}
      <div className="absolute inset-0 bg-radial from-transparent via-[#07070c]/50 to-[#07070c] pointer-events-none" />

      {/* Контент Hero-секции */}
      <div className="relative z-10 mx-auto max-w-5xl text-center flex flex-col items-center space-y-7">
        
        {/* Trust Badge */}
        {trustBadge && (
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/15 px-4 py-1.5 shadow-xl transition-all hover:bg-white/[0.12] hover:border-white/25">
            {trustBadge.icons && trustBadge.icons.length > 0 && (
              <span className="flex items-center gap-1 text-sm">
                {trustBadge.icons.map((icon, idx) => (
                  <span key={idx}>{icon}</span>
                ))}
              </span>
            )}
            <span className="font-['Plus_Jakarta_Sans',sans-serif] text-xs sm:text-sm font-semibold text-white/90">
              {trustBadge.text}
            </span>
          </div>
        )}

        {/* Headline */}
        {headline && (
          <div className="space-y-2">
            <h1 className="font-['Outfit',sans-serif] text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
              <span className="block">{headline.line1}</span>
              {headline.line2 && (
                <span className="block bg-gradient-to-r from-white via-purple-200 to-indigo-300 bg-clip-text text-transparent">
                  {headline.line2}
                </span>
              )}
            </h1>
          </div>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-base sm:text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed font-normal">
            {subtitle}
          </p>
        )}

        {/* CTA Buttons */}
        {buttons && (buttons.primary || buttons.secondary) && (
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
            {buttons.primary && (
              <button
                type="button"
                onClick={buttons.primary.onClick}
                className="font-['Outfit',sans-serif] inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm sm:text-base font-black text-slate-950 shadow-2xl hover:bg-slate-200 transition-all transform active:scale-95 cursor-pointer"
              >
                {buttons.primary.text}
              </button>
            )}

            {buttons.secondary && (
              <button
                type="button"
                onClick={buttons.secondary.onClick}
                className="font-['Outfit',sans-serif] inline-flex items-center justify-center rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/20 px-8 py-3.5 text-sm sm:text-base font-bold text-white hover:bg-white/[0.16] hover:border-white/30 transition-all transform active:scale-95 cursor-pointer"
              >
                {buttons.secondary.text}
              </button>
            )}
          </div>
        )}

        {/* Дополнительный слот */}
        {children}
      </div>
    </section>
  );
};

export default Hero;
