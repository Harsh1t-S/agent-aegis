import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

interface CountUpProps {
  value: number;
  /** Rendered instead of the number when there is nothing to count. */
  placeholder?: string;
  /** Zero-pads to this width, so 4 reads as 04 beside 12. */
  pad?: number;
  className?: string;
  durationMs?: number;
}

/**
 * A number that climbs to its value when it comes into view.
 *
 * The landing page used to derive these from `scrollYProgress` — the fraction of
 * the *whole document* scrolled — mapping 0.25→0.45 onto 0→total. That only lines
 * up with where the section actually sits if the page is exactly the height it was
 * when the numbers were picked, and it never is: the page grows with the data,
 * shrinks on a wider viewport, and moves every time a section is added. On a
 * desktop viewport the suite counter peaked at 4 out of 12 and then the section
 * scrolled away; on a phone it read 00.
 *
 * A count-up should be driven by the element being looked at, not by the document
 * around it. This one watches itself, and — like ReliabilityScore — it treats the
 * animation as decoration over a value that is already correct: it starts at the
 * true number, so a reader with reduced motion, a throttled frame loop, or a
 * viewport that never fires the observer still sees the real figure rather than a
 * zero.
 */
export function CountUp({
  value,
  placeholder = '—',
  pad = 0,
  className = '',
  durationMs = 1200,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!inView || reduceMotion || value <= 0) {
      setDisplay(value);
      return;
    }
    setDisplay(0);
    const controls = animate(0, value, {
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    // The last frame is not guaranteed to land exactly on the target.
    void controls.finished.then(() => setDisplay(value)).catch(() => undefined);
    return () => {
      controls.stop();
      setDisplay(value);
    };
  }, [inView, reduceMotion, value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {value > 0 ? String(display).padStart(pad, '0') : placeholder}
    </span>
  );
}
