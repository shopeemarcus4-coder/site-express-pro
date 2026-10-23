import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageIntro } from "@/components/site/PageIntro";


export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda — Site Express" },
      { name: "description", content: "Dúvidas frequentes sobre criação, edição e exportação de sites." },
      { property: "og:title", content: "Ajuda — Site Express" },
      { property: "og:description", content: "Dúvidas frequentes sobre criação, edição e exportação de sites." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <PageIntro eyebrow="Ajuda" title="Central de ajuda.">Dúvidas frequentes sobre criação, edição e exportação de sites.</PageIntro>
      <section className="mx-auto max-w-3xl space-y-6 px-5 pb-24 md:px-8"><div><h2 className="text-lg font-semibold">Preciso saber programar?</h2><p className="text-muted-foreground">Não. A edição é visual, clicando direto no site.</p></div><div><h2 className="text-lg font-semibold">O site exportado depende da plataforma?</h2><p className="text-muted-foreground">Não. O pacote funciona em qualquer hospedagem.</p></div></section>
      <SiteFooter />
    </div>
  );
}
