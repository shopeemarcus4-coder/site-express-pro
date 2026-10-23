import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  LayoutTemplate,
  Menu,
  MonitorSmartphone,
  Moon,
  MousePointer2,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import "../../styles/marketing.css";

type Theme = "light" | "dark";

const steps = [
  {
    icon: Search,
    title: "Pesquise",
    description: "Encontre a empresa ou comece com os dados que você já tem.",
  },
  {
    icon: Check,
    title: "Complete",
    description: "Confira as informações e escolha o que entra no site.",
  },
  {
    icon: MousePointer2,
    title: "Edite",
    description: "Ajuste textos, imagens e seções diretamente na página.",
  },
  {
    icon: Download,
    title: "Exporte",
    description: "Baixe seu projeto para hospedar onde preferir.",
  },
];

const templates = [
  {
    category: "Gastronomia",
    name: "O sabor em primeiro plano",
    className: "sx-marketing__template--food",
    previewName: "CASA DO SABOR",
    previewHeadline: "Sabores que ficam na memória.",
    previewAction: "Ver cardápio",
  },
  {
    category: "Serviços",
    name: "Confiança em cada detalhe",
    className: "sx-marketing__template--service",
    previewName: "ATELIÊ CLÍNICO",
    previewHeadline: "Cuidado feito para você.",
    previewAction: "Conhecer serviços",
  },
  {
    category: "Produtos",
    name: "Uma vitrine com identidade",
    className: "sx-marketing__template--products",
    previewName: "OBJETO & CASA",
    previewHeadline: "Peças para viver melhor.",
    previewAction: "Explorar coleção",
  },
];

const faqs = [
  {
    question: "Preciso saber programar para criar um site?",
    answer:
      "Não. Você pode começar pelos dados da empresa e editar o conteúdo em uma interface visual.",
  },
  {
    question: "E se minha empresa não aparecer na busca?",
    answer: "Você pode preencher os dados manualmente e continuar a criação normalmente.",
  },
  {
    question: "O site precisa usar as cores do Site Express?",
    answer:
      "Não. A identidade do Site Express pertence ao aplicativo. Cada site pode usar cores, fontes, imagens e logotipo próprios.",
  },
  {
    question: "Posso levar o site para outra hospedagem?",
    answer:
      "O editor oferece exportação. Antes de usar o arquivo em outra hospedagem, confira as imagens, os links e os serviços externos incluídos nele.",
  },
];

export function MarketingPage() {
  const [theme, setTheme] = useState<Theme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("site-express-theme");
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(saved === "light" || saved === "dark" ? saved : preferred ? "dark" : "light");
    setThemeReady(true);
  }, []);

  function changeTheme(next: Theme) {
    setTheme(next);
    window.localStorage.setItem("site-express-theme", next);
  }

  return (
    <main className="sx-marketing" data-theme={theme} data-theme-ready={themeReady}>
      <div className="sx-marketing__top" id="inicio">
        <header className="sx-marketing__header sx-marketing__container">
          <a className="sx-marketing__logo" href="#inicio" aria-label="Site Express, início">
            <span>site</span>
            <span>express</span>
          </a>
          <nav className="sx-marketing__nav" aria-label="Navegação principal">
            <a href="#inicio">Início</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#modelos">Modelos</a>
            <a href="#diferenciais">Por que usar</a>
          </nav>
          <div className="sx-marketing__header-actions">
            <div className="sx-marketing__theme-control" aria-label="Tema da página">
              <button
                type="button"
                aria-label="Usar modo claro"
                aria-pressed={theme === "light"}
                onClick={() => changeTheme("light")}
              >
                <Sun size={17} strokeWidth={1.9} />
              </button>
              <button
                type="button"
                aria-label="Usar modo escuro"
                aria-pressed={theme === "dark"}
                onClick={() => changeTheme("dark")}
              >
                <Moon size={17} strokeWidth={1.9} />
              </button>
            </div>
            <a className="sx-marketing__button sx-marketing__button--small" href="/app">
              Começar agora <ArrowUpRight size={17} />
            </a>
            <button
              className="sx-marketing__menu-button"
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              aria-controls="sx-marketing-mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </header>

        {menuOpen && (
          <nav
            id="sx-marketing-mobile-nav"
            className="sx-marketing__mobile-nav"
            aria-label="Navegação móvel"
          >
            {[
              ["Início", "#inicio"],
              ["Como funciona", "#como-funciona"],
              ["Modelos", "#modelos"],
              ["Por que usar", "#diferenciais"],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                {label} <ArrowUpRight size={16} />
              </a>
            ))}
            <a href="/app" onClick={() => setMenuOpen(false)}>
              Criar meu site <ArrowUpRight size={16} />
            </a>
          </nav>
        )}

        <section
          className="sx-marketing__hero sx-marketing__container"
          aria-labelledby="sx-hero-title"
        >
          <div className="sx-marketing__hero-copy">
            <h1 id="sx-hero-title">
              Sites profissionais <em>do seu jeito.</em>
            </h1>
            <p className="sx-marketing__hero-lead">
              Crie, edite e prepare seu site com rapidez e facilidade. Tudo em um só lugar.
            </p>
            <div className="sx-marketing__hero-actions">
              <a className="sx-marketing__button" href="/app">
                Criar meu site agora <ArrowUpRight size={20} />
              </a>
              <a className="sx-marketing__text-link" href="#como-funciona">
                Ver como funciona <ArrowRight size={19} />
              </a>
            </div>
            <div className="sx-marketing__hero-traits" aria-label="Vantagens do Site Express">
              <span>Editor visual</span>
              <span>Seu estilo</span>
              <span>Layout responsivo</span>
            </div>
          </div>
          <div className="sx-marketing__hero-visual" aria-hidden="true">
            <div className="sx-marketing__scene">
              <img
                className="sx-marketing__scene-image sx-marketing__scene-image--day"
                src="/marketing/room-day.jpg"
                alt=""
                fetchPriority="high"
              />
              <img
                className="sx-marketing__scene-image sx-marketing__scene-image--night"
                src="/marketing/room-night.jpg"
                alt=""
              />
            </div>
          </div>
        </section>
      </div>

      <section className="sx-marketing__steps" id="como-funciona" aria-labelledby="sx-steps-title">
        <div className="sx-marketing__container">
          <div className="sx-marketing__section-heading sx-marketing__section-heading--steps">
            <div>
              <h2 id="sx-steps-title">Da ideia ao seu site.</h2>
            </div>
            <p>
              Um processo simples para transformar as informações da empresa em uma página pronta
              para editar.
            </p>
          </div>
          <div className="sx-marketing__step-grid">
            {steps.map((step, index) => (
              <article className="sx-marketing__step" key={step.title}>
                <div className="sx-marketing__step-top">
                  <step.icon size={23} strokeWidth={1.8} aria-hidden="true" />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="sx-marketing__manifesto"
        id="diferenciais"
        aria-labelledby="sx-manifesto-title"
      >
        <div className="sx-marketing__container sx-marketing__manifesto-grid">
          <div className="sx-marketing__manifesto-copy">
            <h2 id="sx-manifesto-title">
              Mais controle para criar. <span>Mais espaço para sua marca.</span>
            </h2>
          </div>
          <div className="sx-marketing__manifesto-detail">
            <p>
              Comece com uma estrutura sólida e ajuste o que realmente importa: mensagem, imagens,
              seções e identidade visual. O resultado pertence ao seu negócio.
            </p>
            <div className="sx-marketing__detail-list">
              <div>
                <SlidersHorizontal size={21} />
                <span>Personalize sem perder a estrutura</span>
              </div>
              <div>
                <MonitorSmartphone size={21} />
                <span>Confira em diferentes telas</span>
              </div>
              <div>
                <LayoutTemplate size={21} />
                <span>Escolha um estilo para começar</span>
              </div>
            </div>
            <a className="sx-marketing__text-link" href="/app">
              Abrir o estúdio <ArrowUpRight size={19} />
            </a>
          </div>
        </div>
      </section>

      <section className="sx-marketing__models" id="modelos" aria-labelledby="sx-models-title">
        <div className="sx-marketing__container">
          <div className="sx-marketing__section-heading sx-marketing__section-heading--models">
            <div>
              <h2 id="sx-models-title">Um começo com personalidade.</h2>
            </div>
            <p>
              Três caminhos visuais para explorar. As cores e o conteúdo final são escolhidos para
              cada empresa.
            </p>
          </div>
          <div className="sx-marketing__models-grid">
            {templates.map((template) => (
              <article className="sx-marketing__model" key={template.category}>
                <div className={`sx-marketing__template ${template.className}`} aria-hidden="true">
                  <div className="sx-marketing__template-nav">
                    <strong>{template.previewName}</strong>
                    <span>Menu</span>
                  </div>
                  <div className="sx-marketing__template-body">
                    <span>{template.category}</span>
                    <strong>{template.previewHeadline}</strong>
                    <small>{template.previewAction} ↗</small>
                  </div>
                </div>
                <div className="sx-marketing__model-footer">
                  <div>
                    <span>{template.category}</span>
                    <h3>{template.name}</h3>
                  </div>
                  <a href="/app" aria-label={`Criar site de ${template.category}`}>
                    <ArrowUpRight size={20} />
                  </a>
                </div>
              </article>
            ))}
          </div>
          <p className="sx-marketing__model-note">
            Prévia ilustrativa dos estilos. Cada projeto pode ser personalizado.
          </p>
        </div>
      </section>

      <section className="sx-marketing__faq" aria-labelledby="sx-faq-title">
        <div className="sx-marketing__container sx-marketing__faq-grid">
          <div>
            <h2 id="sx-faq-title">Dúvidas antes de começar?</h2>
            <p>As respostas essenciais para você seguir com segurança.</p>
          </div>
          <div className="sx-marketing__faq-list">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <ChevronDown size={20} aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sx-marketing__closing" aria-labelledby="sx-closing-title">
        <div className="sx-marketing__container sx-marketing__closing-grid">
          <div>
            <h2 id="sx-closing-title">Seu próximo site começa aqui.</h2>
          </div>
          <a className="sx-marketing__button" href="/app">
            Criar meu site agora <ArrowUpRight size={20} />
          </a>
        </div>
      </section>

      <footer className="sx-marketing__footer">
        <div className="sx-marketing__container sx-marketing__footer-inner">
          <a
            className="sx-marketing__logo"
            href="#inicio"
            aria-label="Site Express, voltar ao início"
          >
            <span>site</span>
            <span>express</span>
          </a>
          <p>Sua ideia. Seu site.</p>
          <a href="#inicio">Voltar ao início ↑</a>
        </div>
      </footer>
    </main>
  );
}

export default MarketingPage;
