import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * The top of every console screen: where you are, what this is, and the actions
 * for it, always in the same place. Screens used to invent their own headers, so
 * the primary action moved around and the way back was different on every page.
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
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-bone-600/15 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 font-mono text-xs uppercase tracking-wider text-bone-500">
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
                    {crumb.to && !last ? (
                      <Link to={crumb.to} className="inline-flex min-h-8 items-center break-all hover:text-bone-100">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current={last ? 'page' : undefined} className={`break-all ${last ? 'text-bone-300' : ''}`}>
                        {crumb.label}
                      </span>
                    )}
                    {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-bone-600" aria-hidden />}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-3">{meta}</div>}
        <h1 className="massive mt-2 break-words text-[clamp(1.875rem,3.5vw,2.75rem)] text-bone-50">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-400 sm:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
