/**
 * The floor grid, the horizon glow, and a spotlight that follows the pointer.
 *
 * It fills the nearest positioned ancestor and sits behind it, so the parent needs
 * `relative isolate` (or any stacking context). The spotlight reads `--mx`/`--my`
 * from that parent; without a pointer handler it rests up and to the right.
 */
export function Backdrop({ className = '' }: { className?: string }) {
  const floor = 'linear-gradient(to right, rgba(91,200,232,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(91,200,232,0.18) 1px, transparent 1px)';
  const fade = 'linear-gradient(to bottom, transparent, black 30%, black 75%, transparent)';
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_72%_42%,rgba(38,169,208,0.20),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_15%_20%,rgba(240,85,64,0.07),transparent_70%)]" />
      <div
        className="absolute bottom-[-12%] left-[-50%] h-[62%] w-[200%] origin-top animate-grid-scroll"
        style={{
          backgroundImage: floor,
          backgroundSize: '64px 64px',
          transform: 'perspective(520px) rotateX(64deg)',
          maskImage: fade,
          WebkitMaskImage: fade,
        }}
      />
      <div
        className="absolute inset-0 hidden [@media(pointer:fine)]:block"
        style={{ background: 'radial-gradient(560px circle at var(--mx, 70%) var(--my, 35%), rgba(91,200,232,0.09), transparent 65%)' }}
      />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink-950 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
      <div className="noise absolute inset-0" />
    </div>
  );
}
