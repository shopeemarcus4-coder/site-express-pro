import { Download, FileText, ImageIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = [
  { n: "01", title: "Pesquise", text: "Encontre os dados da sua empresa.", Icon: Search, tone: "bg-step-1" },
  { n: "02", title: "Complete", text: "Adicione as informações que faltam.", Icon: FileText, tone: "bg-step-2" },
  { n: "03", title: "Edite", text: "Personalize tudo do seu jeito.", Icon: ImageIcon, tone: "bg-step-3" },
  { n: "04", title: "Exporte", text: "Baixe o site pronto para hospedar.", Icon: Download, tone: "bg-step-4" },
] as const;

export function StepCards({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4", className)}>
      {STEPS.map(({ n, title, text, Icon, tone }) => (
        <li key={n} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card md:p-5">
          <span className={cn("grid size-14 shrink-0 place-items-center rounded-xl text-brand-foreground", tone, n !== "03" && "text-primary-foreground dark:text-foreground")}>
            <Icon className="size-6" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{n}</p>
            <p className="font-display text-lg font-semibold leading-tight">{title}</p>
            <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
