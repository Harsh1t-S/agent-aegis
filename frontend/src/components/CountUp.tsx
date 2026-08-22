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
 * up with where the section sits if the page is exactly the height it was when
 * those fractions were picked, and it never is: the page grows with the data,
 * shrinks on a wider viewport, and moves whenever a section is added. On a desktop
 * the suite counter peaked at 04 out of 12 and then scrolled away; on a phone it
 * read 00.
 *
 * A count-up should be driven by the element being looked at, not by the document
 * around it. This one watches itself — and it treats the animation as decoration
 * over a value that is already correct, which matters more than it sounds:
 *
 * `animate()` sets the value to its starting keyframe immediately and then relies
 * on the frame loop to advance it. When the frame loop is not running — a
 * backgrounded tab, a throttled or low-power device, an observer that never fires
 * — the number stops at that starting keyframe and stays there. The failure mode
 * is not "the animation looks wrong", it is "the product reports zero", which for
 * a reliability score is the worst possible thing to display.
 *
 * So: the true value is what renders until an animation has actually begun to
 * advance, and a wall-clock watchdog (which fires whether or not frames do) snaps
 * to it if none arrives.
 */
export function CountUp({
  value,
  placeholder = '—',
  pad = 0,
  className = '',
  durationMs = 1200,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!inView || reduceMotion || value <= 0) {
      setDisplay(value);
      return;
    }

    let advanced = false;
    setDisplay(0);
    const controls = animate(0, value, {
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        advanced = true;
        setDisplay(Math.round(v));
      },
    });
    // setTimeout runs off the timer queue, not the frame loop, so it still fires
    // when requestAnimationFrame does not. If nothing has moved by then, the
    // animation is not going to happen and the real number is what belongs here.
    const watchdog = window.setTimeout(() => {
      if (!advanced) {
        controls.stop();
        setDisplay(value);
      }
    }, 400);
    void controls.finished.then(() => setDisplay(value)).catch(() => undefined);

    return () => {
      window.clearTimeout(watchdog);
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
