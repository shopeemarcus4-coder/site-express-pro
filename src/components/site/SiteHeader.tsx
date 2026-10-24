import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { ThemeToggle } from "./theme";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/como-funciona", label: "Como funciona" },
  { to: "/modelos", label: "Modelos" },
] as const;

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header
      className={cn(
        "z-40 w-full",
        overlay
          ? "absolute inset-x-0 top-0"
          : "sticky top-0 border-b border-border bg-background/85 backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-5 md:h-20 md:px-8">
        <Link to="/" className="shrink-0 text-[1.35rem]" aria-label="Site Express — início">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: true }}
              className="relative py-2 text-[0.92rem] text-foreground/80 transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:after:absolute data-[status=active]:after:inset-x-0 data-[status=active]:after:-bottom-0.5 data-[status=active]:after:h-0.5 data-[status=active]:after:rounded-full data-[status=active]:after:bg-brand"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="brand" className="hidden h-11 px-6 sm:inline-flex">
            <Link to="/app">
              Começar agora <ArrowRight />
            </Link>
          </Button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-foreground lg:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-5 pb-6 pt-2 shadow-lift lg:hidden">
          <nav aria-label="Menu móvel" className="flex flex-col">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: true }}
                className="border-b border-border py-3.5 text-base text-foreground data-[status=active]:font-semibold"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Button asChild variant="brand" className="mt-5 h-12 w-full">
            <Link to="/app" onClick={() => setOpen(false)}>
              Começar agora <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
    </header>
  );
}
