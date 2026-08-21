import { Link } from 'react-router-dom';

/**
 * The mark.
 *
 * It was `<Shield />` straight out of lucide — the icon every security product
 * reaches for, which means it identifies the category and not the product. A shield
 * is also slightly wrong for what this thing does: Aegis does not stand in front of
 * an agent and protect it, it attacks the agent to find where it gives way.
 *
 * So the mark is a shield that has been broken on purpose. The outline is drawn as
 * two offset plates with a fracture running between them, and the right-hand plate
 * is shifted a couple of units out of true — the failure is already in the object,
 * found under test rather than in production. The stress lines fanning off the
 * fracture are the pressure ladder.
 *
 * Drawn rather than imported so it can carry that idea, and stroked in currentColor
 * so it inherits wherever it sits.
 */
export function AegisMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      {/* Left plate: the intact half. */}
      <path
        d="M15.1 2.6 4.2 6.4v8.9c0 6.2 4.3 11.2 10.9 13.4V2.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Right plate, shifted out of true — the shield has already failed. */}
      <path
        d="M17.9 4.1 27.8 7.6v8.4c0 5.9-4 10.7-9.9 12.8V4.1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* The fracture. */}
      <path
        d="M16.4 3.2 14.4 12l3.4 2.4-2.6 9.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      {/* Stress lines off the break — the pressure ladder, in ascending length. */}
      <path d="M12.3 9.7h-2.4M11.6 14.2H8.4M12.2 18.6h-1.6" stroke="currentColor"
            strokeWidth="1.3" strokeLinecap="round" opacity="0.45" />
      <path d="M20.1 10.4h2.3M20.6 15h2.9" stroke="currentColor"
            strokeWidth="1.3" strokeLinecap="round" opacity="0.45" />
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
      <AegisMark className="h-6 w-6 shrink-0 text-violet-400 transition-colors group-hover:text-violet-300" />
      <span className="font-display text-lg font-bold tracking-tightest text-bone-50">
        AEGIS
      </span>
    </Link>
  );
}
