import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div className="max-w-xs">
          <Logo className="text-xl" />
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Sua ideia. Seu site. Sites profissionais, editáveis e responsivos para empresas brasileiras.
          </p>
        </div>
        <div>
          <p className="eyebrow text-muted-foreground">Produto</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/como-funciona" className="hover:text-foreground text-foreground/80">Como funciona</Link></li>
            <li><Link to="/modelos" className="hover:text-foreground text-foreground/80">Modelos</Link></li>
            <li><Link to="/precos" className="hover:text-foreground text-foreground/80">Preços</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-muted-foreground">Suporte</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/ajuda" className="hover:text-foreground text-foreground/80">Central de ajuda</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-5 py-6 text-xs text-muted-foreground md:px-8">
          © {new Date().getFullYear()} Site Express. Imagens de modelos são demonstrativas.
        </p>
      </div>
    </footer>
  );
}
