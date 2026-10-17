import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * The top of every console screen, laid out the same way every time:
 *
 *   breadcrumbs            where you are, and the way back
 *   title ............ [secondary actions] [primary action]
 *   description
 *
 * The actions sit level with the title, at the right edge on a desktop and full
 * width under it on a phone. Screens used to invent their own headers, so the
 * primary action moved around and the way back was different on every page.
 */
export function PageHeader({
  crumbs,
  title,
  description,
  meta,
  actions,
}: {
  crumbs?: Crumb[];
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  /** Secondary actions first, the one primary action last: it sits at the right edge, and on a phone it stacks on top. */
  actions?: ReactNode;
}) {
  return (
    <header className="page-header mb-8 border-b border-bone-600/20 pb-6">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-x-1 text-sm text-bone-400">
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
                  {crumb.to && !last ? (
                    <Link to={crumb.to} className="inline-flex min-h-8 items-center break-words hover:text-bone-50 hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? 'page' : undefined} className={`break-words ${last ? 'text-bone-200' : ''}`}>
                      {crumb.label}
                    </span>
                  )}
                  {!last && <ChevronRight className="h-4 w-4 shrink-0 text-bone-500" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      {meta && <div className="mb-3 flex flex-wrap items-center gap-3">{meta}</div>}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0">
          <h1 className="break-words font-display text-3xl font-semibold leading-tight tracking-tight text-bone-50 sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-bone-300">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center md:justify-end [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export interface NextStep {
  to: string;
  label: string;
  hint?: string;
}

/**
 * Where to go once this screen has done its job. Agent, run, report, trace and
 * compare are one flow; each end-of-page strip points at the next of them instead
 * of leaving the reader to work out which menu item comes next.
 */
export function NextSteps({ steps }: { steps: NextStep[] }) {
  if (steps.length === 0) return null;
  return (
    <section aria-label="Next steps" className="mt-10 border-t border-bone-600/20 pt-6">
      <h2 className="font-display text-lg font-semibold text-bone-50">Next step</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <li key={step.to}>
            <Link
              to={step.to}
              className="group flex h-full min-h-[4.5rem] items-center justify-between gap-4 border border-bone-600/30 bg-ink-900 px-4 py-3 transition-colors hover:border-signal-500/60 hover:bg-ink-850"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-bone-50">{step.label}</span>
                {step.hint && <span className="mt-0.5 block text-sm text-bone-400">{step.hint}</span>}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-signal-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
