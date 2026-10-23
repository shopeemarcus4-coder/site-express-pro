import type { ReactNode } from "react";

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-10 pt-14 md:px-8 md:pb-14 md:pt-20">
      <div className="flex items-center gap-4">
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <span aria-hidden className="h-px w-16 bg-border" />
      </div>
      <h1 className="mt-5 max-w-3xl text-[2.1rem] font-bold leading-[1.05] md:text-6xl">{title}</h1>
      {children && <div className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{children}</div>}
    </section>
  );
}
