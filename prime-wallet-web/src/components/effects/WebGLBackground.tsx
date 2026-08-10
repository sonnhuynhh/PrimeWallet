import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

/**
 * Nền WebGL (three.js): các đốm màu hồng/tím/xanh trôi chậm trên nền tối,
 * render bằng fragment shader trên một mặt phẳng phủ toàn màn hình.
 *
 * - DPR giới hạn 1.5 để không đốt GPU trên màn 4K.
 * - Tự dừng render khi tab ẩn và khi người dùng bật reduced-motion.
 * - Fallback: nếu WebGL không khởi tạo được thì để nguyên nền CSS phía sau.
 */
export function WebGLBackground({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(mount.clientWidth, mount.clientHeight) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime;
        uniform vec2 uResolution;

        // Đốm sáng mềm: cường độ giảm dần theo khoảng cách tới tâm.
        float blob(vec2 uv, vec2 center, float radius) {
          float d = length(uv - center);
          return smoothstep(radius, 0.0, d);
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / uResolution.xy;
          uv.x *= uResolution.x / uResolution.y;
          float t = uTime * 0.08;

          vec3 pink  = vec3(0.988, 0.447, 1.000);  // #fc72ff
          vec3 violet= vec3(0.706, 0.471, 1.000);  // #b478ff
          vec3 blue  = vec3(0.298, 0.510, 0.984);  // #4c82fb

          vec2 c1 = vec2(0.30 + 0.22 * sin(t * 1.3), 0.72 + 0.18 * cos(t));
          vec2 c2 = vec2(1.10 + 0.25 * cos(t * 0.9), 0.30 + 0.20 * sin(t * 1.7));
          vec2 c3 = vec2(0.70 + 0.30 * sin(t * 0.6), 0.55 + 0.25 * cos(t * 1.1));

          vec3 color = vec3(0.0);
          float a = 0.0;

          float b1 = blob(uv, c1, 0.55) * 0.55;
          float b2 = blob(uv, c2, 0.60) * 0.45;
          float b3 = blob(uv, c3, 0.70) * 0.35;

          color += pink * b1 + blue * b2 + violet * b3;
          a = clamp(b1 + b2 + b3, 0.0, 0.5);

          gl_FragColor = vec4(color, a * 0.55);
        }
      `,
    });

    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();

    const tick = () => {
      if (!running) return;
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) tick();
      else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onResize = () => {
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight);
      uniforms.uResolution.value.set(clientWidth, clientHeight);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(mount);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    />
  );
}
