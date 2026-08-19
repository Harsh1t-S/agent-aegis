import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  ChevronsUpDown,
  FlaskConical,
  GitCompareArrows,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  FileBarChart,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchPalette } from "./SearchPalette";
import { useSearchPalette } from "@/lib/use-search-palette";

const nav = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", to: "/agents", icon: Bot },
  { label: "Evaluations", to: "/evaluations", icon: FlaskConical },
  { label: "Reports", to: "/reports", icon: FileBarChart },
  { label: "Version Comparison", to: "/compare", icon: GitCompareArrows },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export function AegisLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
        <ShieldCheck className="size-4.5" />
      </span>
      {!compact && <span className="text-[15px] font-semibold tracking-tight">Aegis</span>}
    </span>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active =
          item.to === "/dashboard" ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/12 text-foreground ring-1 ring-primary/25"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <item.icon className={cn("size-4", active && "text-primary")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBlock() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-left transition-colors hover:bg-sidebar-accent">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
          AE
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">Local workspace</span>
          <span className="block truncate text-xs text-muted-foreground">No sign-in required</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      {/* This deployment has no authentication, so it shows no user. A fabricated
          name and a Sign out link that only navigates home read as a mockup — and
          would be the first thing a reviewer pulled on. */}
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
          Single shared workspace. Anyone with the link sees the same agents and runs.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">Workspace settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="https://github.com/Harsh1t-S/aegis-evaluator" target="_blank" rel="noreferrer">
            Source and API docs
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

export function AppLayout({
  title,
  crumbs = [],
  actions,
  children,
}: {
  title: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { open: searchOpen, setOpen: setSearchOpen } = useSearchPalette();

  return (
    <div className="min-h-screen bg-background">
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
        <Link to="/dashboard" className="px-2 py-1">
          <AegisLogo />
        </Link>
        <div className="mt-6 flex-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Workspace
          </p>
          <NavLinks />
        </div>
        <UserBlock />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[264px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
            <div className="flex items-center justify-between px-2">
              <AegisLogo />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <UserBlock />
          </div>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              {crumbs.length > 0 && (
                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                  {crumbs.map((c, i) => (
                    <span key={`${c.label}-${i}`}>
                      {c.to ? (
                        <Link to={c.to} className="transition-colors hover:text-foreground">
                          {c.label}
                        </Link>
                      ) : (
                        c.label
                      )}
                      {i < crumbs.length - 1 && <span className="px-1.5 opacity-50">/</span>}
                    </span>
                  ))}
                </p>
              )}
              <p className="truncate text-sm font-medium">{title}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-4" />
              </Button>
              {/* No authentication here, so no avatar. A set of initials in the
                  topbar implies a signed-in user that does not exist. */}
              {actions && <div className="ml-2 hidden sm:flex">{actions}</div>}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
