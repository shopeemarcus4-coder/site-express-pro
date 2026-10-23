import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageIntro } from "@/components/site/PageIntro";
import { TEMPLATES } from "@/lib/templates";

export const Route = createFileRoute("/modelos")({
  head: () => ({
    meta: [
      { title: "Modelos — Site Express" },
      { name: "description", content: "Modelos profissionais por segmento: gastronomia, serviços e produtos." },
      { property: "og:title", content: "Modelos — Site Express" },
      { property: "og:description", content: "Modelos profissionais por segmento: gastronomia, serviços e produtos." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <PageIntro eyebrow="Modelos" title="Sites prontos para o seu negócio.">Modelos profissionais por segmento: gastronomia, serviços e produtos.</PageIntro>
      <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-24 md:grid-cols-3 md:px-8">{TEMPLATES.map((t) => (<article key={t.id}><img src={t.image} alt={`Prévia demonstrativa do modelo ${t.name}`} width={1280} height={800} loading="lazy" className="aspect-[16/10] w-full rounded-2xl border border-border object-cover object-top shadow-card" /><h2 className="mt-4 text-xl font-semibold">{t.name}</h2><p className="text-sm text-muted-foreground">{t.segment}</p><ul className="mt-3 space-y-1 text-sm text-foreground/80">{t.sections.map((s) => <li key={s}>• {s}</li>)}</ul></article>))}</section>
      <SiteFooter />
    </div>
  );
}
