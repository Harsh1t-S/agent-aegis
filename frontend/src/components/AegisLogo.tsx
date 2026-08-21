import { Link } from 'react-router-dom';

/**
 * The mark: an A, broken on purpose.
 *
 * It was lucide's `<Shield />` — the icon every security product reaches for,
 * which identifies the category and not the product. A shield is also the wrong
 * idea: Aegis does not stand in front of an agent and protect it, it attacks the
 * agent to find where it gives way.
 *
 * So the letterform carries that instead. The A is drawn as two legs that do not
 * meet: the apex is split, the right leg is offset a little out of true, and the
 * crossbar — the part that holds an A together — is the fracture, drawn as a
 * displaced break rather than a straight rule. The short ticks stepping up the
 * left leg are the pressure ladder.
 *
 * Geometric and monoline so it holds at 16px in a browser tab, and stroked in
 * currentColor so it inherits wherever it sits.
 */
export function AegisMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden focusable="false">
      {/* Left leg, rising to a split apex. */}
      <path
        d="M4.6 27.4 14.2 5.2"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="square"
      />
      {/* Right leg, offset — the two halves no longer meet at the top. */}
      <path
        d="M17.4 5.6 27.4 27.4"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="square"
      />
      {/* The crossbar as a fracture: two segments, stepped apart. */}
      <path d="M10.1 18.6h5.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      <path d="M17.1 21.1h5.1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      {/* Pressure ladder up the left leg. */}
      <path
        d="M12.6 12.4h2.1M11.4 15.5h1.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export function AegisLogo({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="Aegis — home"
      className={`group inline-flex min-h-11 items-center gap-2.5 ${className}`}
    >
      <AegisMark className="h-6 w-6 shrink-0 text-signal-400 transition-colors group-hover:text-signal-300" />
      <span className="font-display text-lg font-bold tracking-tightest text-bone-50">
        AEGIS
      </span>
    </Link>
  );
}
