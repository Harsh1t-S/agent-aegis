import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

export function ScrollReveal({ children, delay = 0, y = 40, className = '' }: ScrollRevealProps) {
  return (
    <motion.div
      // `min-w-0` because this wraps most grid items in the app. A grid child
      // defaults to `min-width: auto`, so one long unbreakable string inside a
      // panel stretched its whole track past the viewport on a phone.
      className={`min-w-0 ${className}`}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
