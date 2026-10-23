import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageIntro } from "@/components/site/PageIntro";


export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços — Site Express" },
      { name: "description", content: "Planos em definição. Valores serão divulgados após aprovação comercial." },
      { property: "og:title", content: "Preços — Site Express" },
      { property: "og:description", content: "Planos em definição. Valores serão divulgados após aprovação comercial." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <PageIntro eyebrow="Preços" title="Planos em breve.">Planos em definição. Valores serão divulgados após aprovação comercial.</PageIntro>
      
      <SiteFooter />
    </div>
  );
}
