import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

interface AgentCoreProps {
  destabilized?: boolean;
  size?: number;
  /**
   * Draw the solid centre node.
   *
   * Off wherever the graphic sits *behind* type: the node is an opaque disc with
   * a label on it, so on the hero it punched a dark hole through the middle of
   * "TRUST" and put the word "AI" inside the letterform. The orbits read fine
   * behind text; the centre does not.
   */
  core?: boolean;
}

function useFittedSize(requested: number) {
  const [fitted, setFitted] = useState(requested);

  useEffect(() => {
    // The rings breathe out to about 1.1x the box, so leave headroom rather
    // than letting a rotating decorative layer widen the document.
    const fit = () => setFitted(Math.min(requested, Math.round(window.innerWidth * 0.78)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [requested]);

  return fitted;
}

export function AgentCore({
  destabilized = false,
  size: requested = 400,
  core = true,
}: AgentCoreProps) {
  const size = useFittedSize(requested);
  const orbits = useMemo(
    () => [
      { radius: size * 0.28, duration: 18, points: 6, reverse: false },
      { radius: size * 0.38, duration: 26, points: 9, reverse: true },
      { radius: size * 0.48, duration: 34, points: 12, reverse: false },
    ],
    [size],
  );

  const fragments = useMemo(
    () => [
      'check_order()',
      'refund policy',
      'auth verify',
      'edge case',
      'conflict',
      'manipulate',
      'tool fail',
      'goal drift',
      'overconfident',
      'unsafe action',
    ],
    [],
  );

  return (
    <div
      className="relative flex max-w-full items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Pulsing rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute rounded-full border"
          style={{
            width: size * (0.3 + i * 0.2),
            height: size * (0.3 + i * 0.2),
            borderColor: destabilized ? 'rgba(240,85,64,0.25)' : 'rgba(91,200,232,0.2)',
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.05, 0.3],
          }}
          transition={{
            duration: 4 + i * 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.8,
          }}
        />
      ))}

      {/* Core glow */}
      <motion.div
        className="absolute rounded-full blur-2xl"
        style={{
          width: size * 0.3,
          height: size * 0.3,
          background: destabilized
            ? 'radial-gradient(circle, rgba(240,85,64,0.4), transparent 70%)'
            : 'radial-gradient(circle, rgba(91,200,232,0.35), transparent 70%)',
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Orbit rings with data points */}
      {orbits.map((orbit, oi) => (
        <div
          key={`orbit-${oi}`}
          className="absolute rounded-full border"
          style={{
            width: orbit.radius * 2,
            height: orbit.radius * 2,
            borderColor: 'rgba(139,130,112,0.15)',
          }}
        >
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: orbit.reverse ? -360 : 360 }}
            transition={{ duration: orbit.duration, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: orbit.points }).map((_, pi) => {
              const angle = (pi / orbit.points) * Math.PI * 2;
              const x = Math.cos(angle) * orbit.radius;
              const y = Math.sin(angle) * orbit.radius;
              return (
                <div
                  key={pi}
                  className="absolute h-1.5 w-1.5 rounded-full"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(${x}px, ${y}px)`,
                    background: destabilized
                      ? pi % 3 === 0
                        ? '#f05540'
                        : '#8b8270'
                      : pi % 4 === 0
                        ? '#26a9d0'
                        : pi % 2 === 0
                          ? '#1cb8d8'
                          : '#8b8270',
                    boxShadow: destabilized
                      ? pi % 3 === 0
                        ? '0 0 8px #f05540'
                        : 'none'
                      : pi % 4 === 0
                        ? '0 0 8px #26a9d0'
                        : pi % 2 === 0
                          ? '0 0 6px #1cb8d8'
                          : 'none',
                  }}
                />
              );
            })}
          </motion.div>
        </div>
      ))}

      {/* Connection lines (SVG) */}
      <svg className="absolute inset-0" viewBox={`-${size / 2} -${size / 2} ${size} ${size}`}>
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x1 = Math.cos(angle) * size * 0.1;
          const y1 = Math.sin(angle) * size * 0.1;
          const x2 = Math.cos(angle) * size * 0.45;
          const y2 = Math.sin(angle) * size * 0.45;
          return (
            <motion.line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={destabilized ? 'rgba(240,85,64,0.15)' : 'rgba(91,200,232,0.12)'}
              strokeWidth={1}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: [0, 1, 0], opacity: [0, 0.6, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.3,
                ease: 'easeInOut',
              }}
            />
          );
        })}
      </svg>

      {/* Central node */}
      {core && (
      <motion.div
        className="relative z-10 flex items-center justify-center rounded-full border border-signal-500/40 bg-ink-850"
        style={{ width: size * 0.18, height: size * 0.18 }}
        animate={{
          borderColor: destabilized
            ? ['rgba(240,85,64,0.4)', 'rgba(240,85,64,0.8)', 'rgba(240,85,64,0.4)']
            : ['rgba(91,200,232,0.4)', 'rgba(91,200,232,0.8)', 'rgba(91,200,232,0.4)'],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-bone-300">
          {destabilized ? 'ERR' : 'AI'}
        </span>
      </motion.div>
      )}

      {/* Floating scenario fragments */}
      {fragments.slice(0, destabilized ? 10 : 5).map((frag, i) => {
        const angle = (i / fragments.length) * Math.PI * 2;
        const dist = size * 0.55;
        return (
          <motion.span
            key={frag}
            className="absolute font-mono text-[9px] uppercase tracking-wider whitespace-nowrap"
            style={{
              left: '50%',
              top: '50%',
              color: destabilized && i % 3 === 0 ? '#ff7a68' : '#8b8270',
            }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              delay: i * 0.7,
              ease: 'easeInOut',
            }}
          >
            {frag}
          </motion.span>
        );
      })}
    </div>
  );
}
