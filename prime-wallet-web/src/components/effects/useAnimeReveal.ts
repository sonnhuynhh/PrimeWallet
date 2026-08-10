import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

/**
 * Hiệu ứng xuất hiện bằng anime.js: các phần tử con khớp `selector` trong
 * container lần lượt trượt lên + hiện dần khi mount.
 *
 * Dùng: const ref = useAnimeReveal('[data-reveal]'); rồi gắn ref vào container.
 */
export function useAnimeReveal<T extends HTMLElement = HTMLDivElement>(
  selector = '[data-reveal]',
  options?: { delay?: number; distance?: number },
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = root.querySelectorAll(selector);
    if (targets.length === 0) return;

    const animation = animate(targets, {
      translateY: [options?.distance ?? 24, 0],
      opacity: [0, 1],
      duration: 700,
      delay: stagger(90, { start: options?.delay ?? 0 }),
      ease: 'outCubic',
    });

    return () => {
      animation.cancel();
    };
    // Chạy đúng một lần khi mount — selector/options coi như bất biến.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
