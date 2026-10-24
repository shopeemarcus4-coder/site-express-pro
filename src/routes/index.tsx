import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Download,
  MonitorSmartphone,
  MousePointerClick,
  Palette,
  Search,
  Smartphone,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StepCards } from "@/components/site/Steps";
import { Scene } from "@/components/site/Scene";
import { TEMPLATES } from "@/lib/templates";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Site Express — Sites profissionais do seu jeito" },
      {
        name: "description",
        content:
          "Pesquise sua empresa, complete as informações, edite visualmente e exporte um site profissional e responsivo.",
      },
      { property: "og:title", content: "Site Express — Sites profissionais do seu jeito" },
      {
        property: "og:description",
        content:
          "Sua ideia. Seu site. Crie, edite e exporte sites comerciais elegantes sem programar.",
      },
    ],
  }),
  component: Home,
});

const BENEFITS = [
  {
    Icon: Zap,
    title: "Rapidez",
    text: "Comece a partir dos dados da empresa, sem tela em branco.",
  },
  {
    Icon: Palette,
    title: "Personalização",
    text: "Cores, logo, fotos e textos com a identidade de cada cliente.",
  },
  {
    Icon: MonitorSmartphone,
    title: "Responsivo",
    text: "Ajustes próprios para celular, tablet e computador.",
  },
];

const DIFFS = [
  {
    Icon: MousePointerClick,
    title: "Controle visual",
    text: "Clique no texto ou na imagem do próprio site para editar. Desfazer e refazer de verdade.",
  },
  {
    Icon: Search,
    title: "Dados comerciais",
    text: "Busque sua empresa quando a integração estiver ativa ou preencha as informações manualmente.",
  },
  {
    Icon: Download,
    title: "Exportação independente",
    text: "Baixe um arquivo HTML com o estilo e suas imagens incorporadas para hospedar onde preferir.",
  },
];

function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <SiteHeader overlay />
        {/* desktop scene */}
        <Scene className="absolute inset-0 hidden md:block" priority />
        <div aria-hidden className="absolute inset-0 hidden bg-hero-fade md:block" />

        <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-28 md:min-h-[min(820px,92vh)] md:px-8 md:pb-44 md:pt-40">
          <div className="max-w-xl">
            <div className="flex items-center gap-4">
              <p className="eyebrow text-hero-muted">Sua ideia. Seu site.</p>
              <span aria-hidden className="h-px w-20 bg-hero-muted/60" />
            </div>
            <h1 className="mt-6 text-[2.75rem] font-normal leading-[1.02] text-hero-foreground sm:text-6xl lg:text-[4.4rem]">
              Sites profissionais <span className="text-brand-text">do seu jeito.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-hero-muted">
              Pesquise uma empresa, complete as informações e edite o site visualmente. Tudo em um
              só lugar.
            </p>
            <div className="mt-9">
              <Button asChild variant="brand" size="xl">
                <Link to="/app">
                  Criar meu site agora <ArrowRight />
                </Link>
              </Button>
            </div>
            <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-hero-muted">
              <li className="flex items-center gap-2">
                <Zap className="size-[18px]" strokeWidth={1.7} /> Rápido e fácil
              </li>
              <li className="flex items-center gap-2">
                <Palette className="size-[18px]" strokeWidth={1.7} /> Design profissional
              </li>
              <li className="flex items-center gap-2">
                <Smartphone className="size-[18px]" strokeWidth={1.7} /> 100% responsivo
              </li>
            </ul>
          </div>
        </div>

        {/* mobile scene crop, after text */}
        <div className="relative aspect-[4/3] md:hidden">
          <Scene className="absolute inset-0" priority />
        </div>
      </section>

      {/* Steps strip overlapping hero bottom */}
      <section className="relative z-10 mx-auto -mt-2 max-w-7xl px-5 md:-mt-24 md:px-8">
        <StepCards />
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
          <div>
            <p className="eyebrow text-muted-foreground">Por que Site Express</p>
            <h2 className="mt-4 text-3xl font-normal leading-tight md:text-[2.6rem]">
              O acabamento de um estúdio, a facilidade de um editor.
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {BENEFITS.map(({ Icon, title, text }) => (
              <div key={title}>
                <Icon className="size-6 text-foreground" strokeWidth={1.7} />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
          <div>
            <p className="eyebrow text-muted-foreground">Modelos por segmento</p>
            <h2 className="mt-4 text-3xl font-normal md:text-[2.6rem]">
              Um ponto de partida para cada negócio.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TEMPLATES.map((t) => (
              <article key={t.id}>
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  <img
                    src={t.image}
                    alt={`Prévia demonstrativa do modelo ${t.name}`}
                    width={1280}
                    height={800}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover object-top"
                  />
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-semibold">{t.name}</h3>
                  <p className="text-sm text-muted-foreground">{t.segment}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            Imagens demonstrativas. Empresas e conteúdos fictícios.
          </p>
        </div>
      </section>

      {/* Differentials */}
      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <p className="eyebrow text-muted-foreground">Diferenciais</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-normal md:text-[2.6rem]">
          Feito para quem entrega sites a clientes reais.
        </h2>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {DIFFS.map(({ Icon, title, text }) => (
            <div key={title} className="bg-background p-8">
              <span className="grid size-11 place-items-center rounded-xl bg-surface-strong">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <h3 className="mt-6 text-xl font-semibold">{title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <ul className="mt-10 grid gap-3 text-sm text-foreground/85 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Sem depoimentos inventados",
            "Sem dados fabricados",
            "SEO em cada página",
            "Você é dono do seu site",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check className="size-4 text-step-4" /> {t}
            </li>
          ))}
        </ul>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-20 md:px-8 md:pb-28">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-background text-foreground">
          <Scene className="absolute inset-0 opacity-80 dark:opacity-60" />
          <div aria-hidden className="absolute inset-0 bg-hero-fade" />
          <div className="relative px-7 py-14 md:px-14 md:py-20">
            <p className="eyebrow text-hero-muted">Seu site começa aqui</p>
            <h2 className="mt-4 max-w-lg text-3xl font-normal text-hero-foreground md:text-5xl">
              Escolha um modelo e comece agora.
            </h2>
            <Button asChild variant="brand" size="xl" className="mt-8">
              <Link to="/app">
                Começar agora <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
