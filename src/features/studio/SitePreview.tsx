import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ExternalLink,
  MapPin,
  MessageCircle,
  Play,
  Plus,
} from "lucide-react";
import type { SiteProject, SiteSectionId } from "./types";

export type EditableField = keyof SiteProject["content"] | "business.name" | "business.category";

interface SitePreviewProps {
  project: SiteProject;
  editable?: boolean;
  selectedField?: EditableField | null;
  onSelectField?: (field: EditableField) => void;
  onEditField?: (field: EditableField, value: string) => void;
  onSelectImage?: () => void;
}

const isSafeHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const whatsappHref = (project: SiteProject) => {
  const digits = project.business.whatsapp.replace(/\D/g, "");
  const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  const text = encodeURIComponent(
    `Olá! Vim pelo site de ${project.business.name} e gostaria de conversar.`,
  );
  return phone.length >= 12 ? `https://wa.me/${phone}?text=${text}` : "#contato";
};

function EditText({
  field,
  value,
  placeholder,
  editable,
  selectedField,
  onSelectField,
  onEditField,
  className,
  tag = "span",
}: {
  field: EditableField;
  value: string;
  placeholder?: string | undefined;
  editable?: boolean | undefined;
  selectedField?: EditableField | null | undefined;
  onSelectField?: ((field: EditableField) => void) | undefined;
  onEditField?: ((field: EditableField, value: string) => void) | undefined;
  className?: string | undefined;
  tag?: "span" | "h1" | "h2" | "h3" | "p";
}) {
  const Tag = tag;
  const display = value || (editable ? placeholder || "Clique para editar" : "");
  return (
    <Tag
      key={`${field}:${value}`}
      className={[
        className,
        editable ? "sx-editable" : "",
        selectedField === field ? "sx-editable--selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-edit-field={editable ? field : undefined}
      data-empty={value ? undefined : "true"}
      contentEditable={editable || undefined}
      suppressContentEditableWarning
      spellCheck={editable}
      onClick={
        editable
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelectField?.(field);
            }
          : undefined
      }
      onBlur={
        editable
          ? (event) => {
              const next = event.currentTarget.textContent?.trim() || "";
              if (next !== value) onEditField?.(field, next);
            }
          : undefined
      }
      onKeyDown={
        editable
          ? (event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }
          : undefined
      }
    >
      {display}
    </Tag>
  );
}

function ActionLink({
  project,
  children,
  className,
  editable,
}: {
  project: SiteProject;
  children: ReactNode;
  className: string;
  editable?: boolean;
}) {
  const href = whatsappHref(project);
  return (
    <a
      className={className}
      href={editable ? undefined : href}
      target={!editable && href.startsWith("https") ? "_blank" : undefined}
      rel="noopener noreferrer"
      onClick={editable ? (event) => event.preventDefault() : undefined}
    >
      {children}
    </a>
  );
}

export function SitePreview({
  project,
  editable = false,
  selectedField,
  onSelectField,
  onEditField,
  onSelectImage,
}: SitePreviewProps) {
  const { business, appearance, content, sections } = project;
  const palette = appearance.palette;
  const themeStyle = {
    "--sx-c-primary": palette.primary,
    "--sx-c-secondary": palette.secondary,
    "--sx-c-accent": palette.accent,
    "--sx-c-surface": palette.surface,
    "--sx-c-ink": palette.ink,
    "--sx-c-soft": palette.soft,
    "--sx-image-position": appearance.heroPosition,
  } as CSSProperties;
  const active = (id: SiteSectionId) =>
    sections.some((section) => section.id === id && section.enabled);
  const text = (
    field: EditableField,
    value: string,
    tag: "span" | "h1" | "h2" | "h3" | "p" = "span",
    className?: string,
    placeholder?: string,
  ) => (
    <EditText
      field={field}
      value={value}
      tag={tag}
      className={className}
      placeholder={placeholder}
      editable={editable}
      selectedField={selectedField}
      onSelectField={onSelectField}
      onEditField={onEditField}
    />
  );
  const location = [business.city, business.state].filter(Boolean).join(" · ");
  const hasContact = business.whatsapp.replace(/\D/g, "").length >= 10;
  const navItems = [
    active("services") && project.items.length > 0
      ? {
          href: "#servicos",
          label:
            project.archetype === "gastronomia"
              ? "Cardápio"
              : project.archetype === "produtos"
                ? "Produtos"
                : "Serviços",
        }
      : null,
    active("about") && !!content.aboutBody ? { href: "#sobre", label: "Sobre" } : null,
    active("gallery") && project.gallery.length > 0 ? { href: "#galeria", label: "Galeria" } : null,
    active("contact") ? { href: "#contato", label: "Contato" } : null,
  ].filter((value): value is { href: string; label: string } => !!value);

  return (
    <div
      className="sx-site"
      data-archetype={project.archetype}
      data-hero-layout={appearance.heroLayout}
      data-heading-font={appearance.headingFont}
      style={themeStyle}
    >
      <header className="sx-site-header">
        <a className="sx-site-brand" href="#inicio" aria-label={`Início: ${business.name}`}>
          {(business.logoUrl && isSafeHttpUrl(business.logoUrl)) ||
          business.logoUrl.startsWith("data:image/") ? (
            <img src={business.logoUrl} alt="" />
          ) : (
            <span className="sx-site-brand-mark" aria-hidden="true">
              {business.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          {text("business.name", business.name, "span", "sx-site-brand-name")}
        </a>
        <nav aria-label="Navegação do site">
          {navItems.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <ActionLink project={project} editable={editable} className="sx-site-header-cta">
          {hasContact ? "Fale conosco" : "Contato"}
          <ArrowRight size={16} aria-hidden="true" />
        </ActionLink>
      </header>

      {active("hero") && (
        <section id="inicio" className="sx-site-hero">
          <div className="sx-site-hero-content">
            {text(
              "eyebrow",
              content.eyebrow,
              "span",
              "sx-site-eyebrow",
              "Seu segmento · Sua cidade",
            )}
            {text("heroTitle", content.heroTitle, "h1", "sx-site-hero-title")}
            {text("heroSubtitle", content.heroSubtitle, "p", "sx-site-hero-subtitle")}
            <div className="sx-site-hero-actions">
              <ActionLink
                project={project}
                editable={editable}
                className="sx-site-button sx-site-button--primary"
              >
                {text("ctaLabel", content.ctaLabel)}
                <ArrowRight size={18} aria-hidden="true" />
              </ActionLink>
              {active("services") && project.items.length > 0 && (
                <a href="#servicos" className="sx-site-button sx-site-button--secondary">
                  Conhecer mais <ArrowDownRight size={18} aria-hidden="true" />
                </a>
              )}
            </div>
            {location && (
              <p className="sx-site-location">
                <MapPin size={15} aria-hidden="true" /> {location}
              </p>
            )}
          </div>
          <div
            className={`sx-site-hero-visual ${appearance.heroImage ? "sx-site-hero-visual--photo" : ""}`}
          >
            {appearance.heroImage ? (
              <img
                src={appearance.heroImage}
                alt={appearance.heroImageAlt || ""}
                style={{ objectPosition: appearance.heroPosition }}
              />
            ) : (
              <div className="sx-site-hero-visual-placeholder" aria-hidden="true">
                <span>{business.name.slice(0, 1).toUpperCase()}</span>
                <small>{business.category || "Seu negócio"}</small>
              </div>
            )}
            {editable && (
              <button type="button" className="sx-site-image-edit" onClick={onSelectImage}>
                Trocar imagem
              </button>
            )}
          </div>
          {project.isDemo && <span className="sx-site-demo-badge">Modelo de demonstração</span>}
        </section>
      )}

      {sections
        .filter((section) => section.enabled && section.id !== "hero")
        .map((section) => {
          if (section.id === "services") {
            if (!editable && project.items.length === 0) return null;
            return (
              <section
                key={section.id}
                id="servicos"
                className="sx-site-section sx-site-services"
                data-export-omit={project.items.length === 0 ? "true" : undefined}
              >
                <div className="sx-site-section-intro">
                  {text("servicesTitle", content.servicesTitle, "h2")}
                  <p>
                    {project.archetype === "gastronomia"
                      ? "Escolha o que combina com hoje."
                      : project.archetype === "produtos"
                        ? "Uma seleção preparada para você."
                        : "Soluções para as suas necessidades."}
                  </p>
                </div>
                {project.items.length ? (
                  <div className="sx-site-items">
                    {project.items.map((item, index) => (
                      <article className="sx-site-item" key={item.id}>
                        {item.image && <img src={item.image} alt="" loading="lazy" />}
                        <div>
                          <span className="sx-site-item-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3>{item.title}</h3>
                          <p>{item.description}</p>
                          {item.price && <strong>{item.price}</strong>}
                        </div>
                        <ActionLink
                          project={project}
                          editable={editable}
                          className="sx-site-item-link"
                        >
                          Consultar <ArrowRight size={16} aria-hidden="true" />
                        </ActionLink>
                      </article>
                    ))}
                  </div>
                ) : (
                  editable && (
                    <p className="sx-site-empty">
                      Adicione serviços ou produtos no painel lateral para preencher esta seção.
                    </p>
                  )
                )}
              </section>
            );
          }
          if (section.id === "about") {
            if (!editable && !content.aboutBody) return null;
            return (
              <section
                key={section.id}
                id="sobre"
                className="sx-site-section sx-site-about"
                data-export-omit={!content.aboutBody ? "true" : undefined}
              >
                <div className="sx-site-about-heading">
                  <span>O que nos move</span>
                  {text("aboutTitle", content.aboutTitle, "h2")}
                </div>
                {text(
                  "aboutBody",
                  content.aboutBody,
                  "p",
                  "sx-site-about-copy",
                  "Conte aqui a história deste negócio.",
                )}
              </section>
            );
          }
          if (section.id === "gallery") {
            if (!editable && project.gallery.length === 0) return null;
            return (
              <section
                key={section.id}
                id="galeria"
                className="sx-site-section sx-site-gallery"
                data-export-omit={project.gallery.length === 0 ? "true" : undefined}
              >
                {text("galleryTitle", content.galleryTitle, "h2")}
                {project.gallery.length ? (
                  <div className="sx-site-gallery-grid">
                    {project.gallery.map((image, index) => (
                      <img
                        key={`${image.slice(0, 40)}-${index}`}
                        src={image}
                        alt={`Imagem ${index + 1} de ${business.name}`}
                        loading="lazy"
                      />
                    ))}
                  </div>
                ) : (
                  editable && <p className="sx-site-empty">Adicione fotos reais na aba Mídia.</p>
                )}
              </section>
            );
          }
          if (section.id === "reviews") {
            if (!editable && project.reviews.length === 0) return null;
            return (
              <section
                key={section.id}
                id="avaliacoes"
                className="sx-site-section sx-site-reviews"
                data-export-omit={project.reviews.length === 0 ? "true" : undefined}
              >
                <span>Avaliações</span>
                <h2>O que dizem sobre nós</h2>
                {project.reviews.length ? (
                  <div className="sx-site-review-grid">
                    {project.reviews.map((review) => (
                      <blockquote key={review.id}>
                        <p>“{review.quote}”</p>
                        <footer>
                          <strong>{review.author}</strong>
                          {review.source && <small>{review.source}</small>}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                ) : (
                  editable && (
                    <p className="sx-site-empty">Inclua somente avaliações reais e autorizadas.</p>
                  )
                )}
              </section>
            );
          }
          if (section.id === "faq") {
            if (!editable && project.faqs.length === 0) return null;
            return (
              <section
                key={section.id}
                id="duvidas"
                className="sx-site-section sx-site-faq"
                data-export-omit={project.faqs.length === 0 ? "true" : undefined}
              >
                {text("faqTitle", content.faqTitle, "h2")}
                {project.faqs.length ? (
                  <div>
                    {project.faqs.map((faq) => (
                      <details key={faq.id}>
                        <summary>
                          {faq.question}
                          <Plus size={18} aria-hidden="true" />
                        </summary>
                        <p>{faq.answer}</p>
                      </details>
                    ))}
                  </div>
                ) : (
                  editable && (
                    <p className="sx-site-empty">
                      Adicione respostas confirmadas para dúvidas comuns.
                    </p>
                  )
                )}
              </section>
            );
          }
          if (section.id === "contact")
            return (
              <section key={section.id} id="contato" className="sx-site-contact">
                <div>
                  {text("contactTitle", content.contactTitle, "h2")}
                  {text("contactBody", content.contactBody, "p")}
                </div>
                {hasContact ? (
                  <ActionLink
                    project={project}
                    editable={editable}
                    className="sx-site-button sx-site-button--contact"
                  >
                    <MessageCircle size={19} aria-hidden="true" /> Conversar no WhatsApp{" "}
                    <ArrowRight size={18} aria-hidden="true" />
                  </ActionLink>
                ) : editable ? (
                  <p className="sx-site-contact-note">
                    Adicione um número de WhatsApp para ativar o contato.
                  </p>
                ) : null}
                {business.address && (
                  <p className="sx-site-address">
                    <MapPin size={16} aria-hidden="true" />
                    {business.address}
                    {business.city ? `, ${business.city}` : ""}
                  </p>
                )}
                {business.mapsUrl && isSafeHttpUrl(business.mapsUrl) && (
                  <a
                    className="sx-site-maps"
                    href={business.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Como chegar <ExternalLink size={15} aria-hidden="true" />
                  </a>
                )}
              </section>
            );
          if (section.id === "promo") {
            if (!editable && !content.promoBody) return null;
            return (
              <section
                key={section.id}
                className="sx-site-promo"
                data-export-omit={!content.promoBody ? "true" : undefined}
              >
                <div>
                  {text("promoTitle", content.promoTitle, "h2")}
                  {text("promoBody", content.promoBody, "p")}
                </div>
                <ActionLink
                  project={project}
                  editable={editable}
                  className="sx-site-button sx-site-button--secondary"
                >
                  Saiba mais <ArrowRight size={18} aria-hidden="true" />
                </ActionLink>
              </section>
            );
          }
          if (section.id === "video") {
            if (!editable && !content.videoUrl) return null;
            return (
              <section
                key={section.id}
                className="sx-site-section sx-site-video"
                data-export-omit={!content.videoUrl ? "true" : undefined}
              >
                {text("videoTitle", content.videoTitle, "h2")}
                {content.videoUrl && isSafeHttpUrl(content.videoUrl) ? (
                  <a
                    className="sx-site-video-link"
                    href={content.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Play size={22} aria-hidden="true" /> Assistir vídeo{" "}
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                ) : (
                  editable && (
                    <p className="sx-site-empty">Adicione um link de vídeo no painel Conteúdo.</p>
                  )
                )}
              </section>
            );
          }
          return null;
        })}
      <footer className="sx-site-footer">
        <span>{business.name}</span>
        <small>
          {project.isDemo ? "Modelo demonstrativo · " : ""}© {new Date().getFullYear()}{" "}
          {business.name}
        </small>
        <a href="#inicio">Voltar ao início ↑</a>
      </footer>
    </div>
  );
}
