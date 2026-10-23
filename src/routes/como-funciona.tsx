import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageIntro } from "@/components/site/PageIntro";
import { StepCards } from "@/components/site/Steps";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona — Site Express" },
      { name: "description", content: "Quatro etapas reais: pesquise, complete, edite e exporte." },
      { property: "og:title", content: "Como funciona — Site Express" },
      { property: "og:description", content: "Quatro etapas reais: pesquise, complete, edite e exporte." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <PageIntro eyebrow="Como funciona" title="Do dado da empresa ao site pronto.">Quatro etapas reais: pesquise, complete, edite e exporte.</PageIntro>
      <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8"><StepCards /></section>
      <SiteFooter />
    </div>
  );
}
