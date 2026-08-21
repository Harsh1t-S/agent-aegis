import { motion } from 'framer-motion';

interface MassiveHeadingProps {
  lines: string[];
  className?: string;
  delay?: number;
}

export function MassiveHeading({ lines, className = '', delay = 0 }: MassiveHeadingProps) {
  return (
    <h1 className={`massive ${className}`}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span
            className="block"
            initial={{ y: '100%' }}
            whileInView={{ y: '0%' }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.8, delay: delay + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}
