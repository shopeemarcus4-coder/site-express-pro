import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BriefcaseBusiness,
  Eye,
  ExternalLink,
  FileCode2,
  ImagePlus,
  LayoutGrid,
  Monitor,
  Palette,
  Package,
  Plus,
  Redo2,
  SearchCheck,
  Sparkles,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  Undo2,
  UtensilsCrossed,
  X,
  ShoppingBag,
} from "lucide-react";
import { PALETTES, SECTION_LABELS } from "./presets";
import { SitePreview, type EditableField } from "./SitePreview";
import { buildStandaloneHtml } from "./exportHtml";
import { safeImageSrc } from "./media";
import { imageSlots, type ImageSlot } from "../../lib/integrations/image-prompt";
import { createZip } from "./zip";
import { imageAssets, imageChecklist } from "./imageAssets";
import type {
  SiteArchetype,
  SiteFaq,
  SiteItem,
  SiteProject,
  SiteReview,
  SiteSectionId,
} from "./types";
import "../../styles/studio.css";

export type { BusinessInput, SiteProject, SiteArchetype } from "./types";

interface StudioPageProps {
  project: SiteProject;
  onChange: (project: SiteProject) => void;
  onBack: () => void;
  publicationStatus?: "draft" | "published" | "suspended";
  saveStatus?: "saved" | "pending" | "saving" | "error";
  onSave?: () => void;
  onPublish?: (() => void) | undefined;
  publishDisabled?: boolean;
  publicSiteHref?: string | undefined;
  photoReference?: string | undefined;
  enableAiTools?: boolean;
}

type Tab = "sections" | "items" | "brand" | "marketing";
type Viewport = "desktop" | "tablet" | "mobile";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function optimizeImage(file: File, maxWidth: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem neste navegador.");
    let scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 9; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/webp", Math.max(0.48, 0.84 - attempt * 0.05));
      if (!encoded.startsWith("data:image/webp")) {
        throw new Error("Este navegador não consegue otimizar imagens em WebP.");
      }
      // Ten inline images remain comfortably below the workspace API's 3 MB JSON limit.
      if (encoded.length <= 180_000) return encoded;
      scale *= 0.82;
    }
    throw new Error("A imagem é complexa demais para caber no projeto. Escolha outra foto.");
  } finally {
    bitmap.close();
  }
}

function Field({
  label,
  value,
  onCommit,
  multiline = false,
  placeholder,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  // Blur commits create one undo step for the completed edit.
  const input = multiline ? (
    <textarea
      key={value}
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(event) => {
        if (event.currentTarget.value !== value) onCommit(event.currentTarget.value);
      }}
    />
  ) : (
    <input
      key={value}
      type={type}
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(event) => {
        if (event.currentTarget.value !== value) onCommit(event.currentTarget.value);
      }}
    />
  );
  return (
    <div className="sx-studio-field">
      <label>
        {label}
        {input}
      </label>
      {hint && <p className="sx-studio-hint">{hint}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sx-studio-group">
      <h3 className="sx-studio-group-title">{title}</h3>
      {children}
    </section>
  );
}

function archetypeIcon(archetype: SiteArchetype) {
  if (archetype === "gastronomia") return <UtensilsCrossed size={17} />;
  if (archetype === "produtos") return <ShoppingBag size={17} />;
  return <BriefcaseBusiness size={17} />;
}

function projectImageForSlot(project: SiteProject, slot: ImageSlot, index: number): string {
  if (slot === "heroDesktop") return project.appearance.heroImage;
  if (slot === "heroMobile") return project.appearance.heroImageMobile || "";
  if (slot === "aboutDesktop") return project.appearance.aboutImage || "";
  if (slot === "aboutMobile") return project.appearance.aboutImageMobile || "";
  return project.gallery[index] || "";
}

function withProjectImage(
  project: SiteProject,
  slot: ImageSlot,
  image: string,
  mode: "enhance" | "generate" | "remove",
  index: number,
): SiteProject {
  if (slot === "gallery") {
    const flags = project.gallery.map(
      (_, itemIndex) => project.galleryIllustrative?.[itemIndex] ?? false,
    );
    return {
      ...project,
      gallery:
        mode === "generate"
          ? [...project.gallery, image]
          : project.gallery.map((item, itemIndex) => (itemIndex === index ? image : item)),
      galleryIllustrative: mode === "generate" ? [...flags, true] : flags,
    };
  }
  const fields = {
    heroDesktop: ["heroImage", "heroImageIllustrative"],
    heroMobile: ["heroImageMobile", "heroImageMobileIllustrative"],
    aboutDesktop: ["aboutImage", "aboutImageIllustrative"],
    aboutMobile: ["aboutImageMobile", "aboutImageMobileIllustrative"],
  } as const;
  const [imageField, flagField] = fields[slot];
  return {
    ...project,
    appearance: {
      ...project.appearance,
      [imageField]: image,
      [flagField]:
        mode === "generate"
          ? true
          : mode === "remove"
            ? false
            : Boolean(project.appearance[flagField]),
      ...(slot === "heroDesktop" && !project.appearance.heroImageAlt
        ? { heroImageAlt: `Imagem de ${project.business.name}` }
        : {}),
    },
  };
}

export function StudioPage({
  project,
  onChange,
  onBack,
  publicationStatus = "draft",
  saveStatus = "saved",
  onSave,
  onPublish,
  publishDisabled = false,
  publicSiteHref,
  photoReference,
  enableAiTools = false,
}: StudioPageProps) {
  const [tab, setTab] = useState<Tab>("sections");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [selectedField, setSelectedField] = useState<EditableField | null>(null);
  const [toast, setToast] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [rewritingField, setRewritingField] = useState<"heroSubtitle" | "aboutBody" | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageTarget, setImageTarget] = useState<ImageSlot>("heroDesktop");
  const [imageIndex, setImageIndex] = useState(0);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageProposal, setImageProposal] = useState<{
    image: string;
    mode: "enhance" | "generate";
    target: ImageSlot;
    index: number;
    projectId: string;
    original: string;
  } | null>(null);
  const [imageIntegration, setImageIntegration] = useState<{
    configured: boolean;
    dailyLimit: number;
  } | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const past = useRef<SiteProject[]>([]);
  const future = useRef<SiteProject[]>([]);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enableAiTools) return;
    const controller = new AbortController();
    fetch("/api/ai/image", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as unknown) : null))
      .then((value) => {
        if (controller.signal.aborted) return;
        const result = value as { configured?: unknown; dailyLimit?: unknown } | null;
        setImageIntegration({
          configured: result?.configured === true,
          dailyLimit: typeof result?.dailyLimit === "number" ? result.dailyLimit : 4,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setImageIntegration({ configured: false, dailyLimit: 4 });
      });
    return () => controller.abort();
  }, [enableAiTools]);

  const announce = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4500);
  };
  const commit = (next: SiteProject) => {
    past.current = [...past.current.slice(-39), project];
    future.current = [];
    onChange({ ...next, updatedAt: new Date().toISOString() });
    setHistoryVersion((value) => value + 1);
  };
  const editContent = (field: keyof SiteProject["content"], value: string) =>
    commit({ ...project, content: { ...project.content, [field]: value } });
  const rewriteContent = async (field: "heroSubtitle" | "aboutBody") => {
    const sourceProject = projectRef.current;
    const sourceText = sourceProject.content[field].trim();
    if (sourceText.length < 10) {
      announce("Escreva pelo menos dez caracteres antes de pedir uma reescrita.");
      return;
    }
    setRewritingField(field);
    try {
      const response = await fetch("/api/ai/rewrite", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, tone: "profissional" }),
      });
      const body = (await response.json()) as { text?: unknown; error?: unknown };
      if (!response.ok || typeof body.text !== "string")
        throw new Error(
          typeof body.error === "string" ? body.error : "A reescrita não ficou disponível agora.",
        );
      if (projectRef.current !== sourceProject) {
        announce("O projeto mudou durante a reescrita. Tente novamente com o texto atual.");
        return;
      }
      editContent(field, body.text);
      announce("Texto reescrito. Confira os fatos antes de publicar.");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Não foi possível reescrever o texto.");
    } finally {
      setRewritingField(null);
    }
  };
  const editBusiness = (field: keyof SiteProject["business"], value: string) =>
    commit({
      ...project,
      business: { ...project.business, [field]: value },
      ...(field === "name" ? { name: value } : {}),
    });
  const editAppearance = (values: Partial<SiteProject["appearance"]>) =>
    commit({ ...project, appearance: { ...project.appearance, ...values } });
  const editMarketing = (values: Partial<NonNullable<SiteProject["marketing"]>>) =>
    commit({
      ...project,
      marketing: { seoTitle: "", seoDescription: "", ...project.marketing, ...values },
    });
  const editField = (field: EditableField, value: string) => {
    if (field.startsWith("business."))
      editBusiness(field.slice(9) as keyof SiteProject["business"], value);
    else editContent(field as keyof SiteProject["content"], value);
  };
  const undo = () => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(project);
    onChange(previous);
    setHistoryVersion((value) => value + 1);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(project);
    onChange(next);
    setHistoryVersion((value) => value + 1);
  };
  const updateSection = (id: SiteSectionId, enabled: boolean) =>
    commit({
      ...project,
      sections: project.sections.map((section) =>
        section.id === id ? { ...section, enabled } : section,
      ),
    });
  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= project.sections.length) return;
    const sections = [...project.sections];
    [sections[index], sections[target]] = [sections[target]!, sections[index]!];
    commit({ ...project, sections });
  };
  const switchArchetype = (archetype: SiteArchetype) => {
    if (archetype === project.archetype) return;
    const palette = PALETTES[archetype][0]!;
    commit({
      ...project,
      archetype,
      appearance: {
        ...project.appearance,
        paletteId: palette.id,
        palette: palette.value,
        heroLayout:
          archetype === "gastronomia"
            ? "immersive"
            : archetype === "produtos"
              ? "showcase"
              : "split",
        headingFont:
          archetype === "produtos" ? "modern" : archetype === "servicos" ? "classic" : "editorial",
      },
    });
  };
  const updateItem = (id: string, changes: Partial<SiteItem>) =>
    commit({
      ...project,
      items: project.items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    });
  const updateFaq = (id: string, changes: Partial<SiteFaq>) =>
    commit({
      ...project,
      faqs: project.faqs.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    });
  const updateReview = (id: string, changes: Partial<SiteReview>) =>
    commit({
      ...project,
      reviews: project.reviews.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    });
  const upload = async (
    event: ChangeEvent<HTMLInputElement>,
    destination: "hero" | "heroMobile" | "about" | "aboutMobile" | "gallery" | "logo",
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (destination === "gallery" && project.gallery.length >= 8) {
      announce("A galeria aceita até 8 fotos.");
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      announce("Escolha uma imagem JPG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      announce("A imagem original deve ter até 10 MB.");
      return;
    }
    try {
      const image = await optimizeImage(file, destination === "logo" ? 700 : 1600);
      if (destination === "hero")
        editAppearance({
          heroImage: image,
          heroImageIllustrative: false,
          heroImageAlt: project.appearance.heroImageAlt || `Imagem de ${project.business.name}`,
        });
      if (destination === "heroMobile")
        editAppearance({ heroImageMobile: image, heroImageMobileIllustrative: false });
      if (destination === "about")
        editAppearance({ aboutImage: image, aboutImageIllustrative: false });
      if (destination === "aboutMobile")
        editAppearance({ aboutImageMobile: image, aboutImageMobileIllustrative: false });
      if (destination === "logo") editBusiness("logoUrl", image);
      if (destination === "gallery")
        commit({
          ...project,
          gallery: [...project.gallery, image],
          galleryIllustrative: [
            ...project.gallery.map((_, index) => project.galleryIllustrative?.[index] ?? false),
            false,
          ],
        });
      announce("Imagem otimizada e adicionada ao projeto.");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Não foi possível usar esta imagem.");
    }
  };
  const uploadItemImage = async (event: ChangeEvent<HTMLInputElement>, id: string) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      announce("Escolha uma imagem JPG, PNG, WebP ou GIF de até 10 MB.");
      return;
    }
    try {
      updateItem(id, { image: await optimizeImage(file, 900) });
      announce("Foto do item adicionada.");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Não foi possível usar esta imagem.");
    }
  };
  const requestImage = async (mode: "enhance" | "generate") => {
    const sourceProject = projectRef.current;
    const original = projectImageForSlot(sourceProject, imageTarget, imageIndex);
    const responsiveReference =
      mode === "generate" && imageTarget === "heroMobile"
        ? sourceProject.appearance.heroImage
        : mode === "generate" && imageTarget === "aboutMobile"
          ? sourceProject.appearance.aboutImage
          : "";
    if (imagePrompt.trim().length < 10) {
      announce("Descreva a imagem desejada em pelo menos dez caracteres.");
      return;
    }
    if (mode === "enhance" && !original) {
      announce("Envie uma foto autorizada antes de pedir uma melhoria.");
      return;
    }
    if (mode === "generate" && imageTarget === "gallery" && sourceProject.gallery.length >= 8) {
      announce("A galeria já tem oito imagens. Remova uma antes de gerar outra.");
      return;
    }
    setImageBusy(true);
    setImageProposal(null);
    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          slot: imageTarget,
          prompt: imagePrompt.trim(),
          business: {
            name: sourceProject.business.name,
            category: sourceProject.business.category,
            city: sourceProject.business.city,
            colors: [
              sourceProject.appearance.palette.primary,
              sourceProject.appearance.palette.secondary,
              sourceProject.appearance.palette.accent,
            ],
          },
          ...(mode === "enhance" ? { sourceImage: original } : {}),
          ...(responsiveReference ? { referenceImage: responsiveReference } : {}),
        }),
      });
      const body = (await response.json()) as { image?: unknown; error?: unknown };
      if (!response.ok || typeof body.image !== "string")
        throw new Error(
          typeof body.error === "string" ? body.error : "O Gemini não retornou uma imagem.",
        );
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(body.image))
        throw new Error("O Gemini retornou um formato de imagem não aceito.");
      setImageProposal({
        image: body.image,
        mode,
        target: imageTarget,
        index: imageIndex,
        projectId: sourceProject.id,
        original,
      });
      announce("Prévia pronta. Confira a imagem antes de aplicá-la.");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Não foi possível criar a imagem.");
    } finally {
      setImageBusy(false);
    }
  };
  const acceptImage = async () => {
    const proposal = imageProposal;
    if (!proposal) return;
    const current = projectRef.current;
    const currentOriginal = projectImageForSlot(current, proposal.target, proposal.index);
    if (current.id !== proposal.projectId || currentOriginal !== proposal.original) {
      setImageProposal(null);
      announce(
        "A foto original mudou. Gere uma nova prévia para evitar substituir a imagem errada.",
      );
      return;
    }
    if (
      proposal.mode === "generate" &&
      proposal.target === "gallery" &&
      current.gallery.length >= 8
    ) {
      announce("A galeria já tem oito imagens. Remova uma antes de aplicar a prévia.");
      return;
    }
    setImageBusy(true);
    try {
      const blob = await (await fetch(proposal.image)).blob();
      const image = await optimizeImage(new File([blob], "gemini.png", { type: blob.type }), 1600);
      const latest = projectRef.current;
      if (
        latest.id !== proposal.projectId ||
        projectImageForSlot(latest, proposal.target, proposal.index) !== proposal.original ||
        (proposal.mode === "generate" &&
          proposal.target === "gallery" &&
          latest.gallery.length >= 8)
      ) {
        setImageProposal(null);
        announce("O projeto mudou. Gere uma nova prévia antes de aplicar esta imagem.");
        return;
      }
      commit(withProjectImage(latest, proposal.target, image, proposal.mode, proposal.index));
      setImageProposal(null);
      announce("Imagem aplicada ao projeto. Revise antes de publicar.");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Não foi possível aplicar a imagem.");
    } finally {
      setImageBusy(false);
    }
  };
  const downloadProposedImage = async () => {
    if (!imageProposal) return;
    try {
      const blob = await (await fetch(imageProposal.image)).blob();
      const extension =
        blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
      const name =
        imageProposal.target === "gallery"
          ? `galeria-${project.gallery.length + 1}.${extension}`
          : imageSlots[imageProposal.target].filename.replace(/\.webp$/, `.${extension}`);
      downloadBlob(blob, name);
    } catch {
      announce("Não foi possível baixar o original gerado pelo Gemini.");
    }
  };
  const saveHtml = () => {
    const html = buildStandaloneHtml(project);
    downloadBlob(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      `${project.slug || "meu-site"}.html`,
    );
    announce("HTML baixado. Links e mídias externas exigem internet.");
  };
  const saveZip = () => {
    try {
      const html = buildStandaloneHtml(project);
      const assets = imageAssets(project);
      const readme = `SITE EXPRESS · PACOTE DO SITE\n\n1. Extraia o arquivo ZIP.\n2. Abra index.html no navegador para conferir o site.\n3. Para publicar, envie index.html para a raiz de uma hospedagem de arquivos estáticos.\n\nOs estilos e as imagens enviadas pelo editor estão incorporados em index.html. As imagens disponíveis também estão separadas no ZIP; fotos por URL externa não podem ser incluídas sem o arquivo original. As imagens incorporadas ao site foram otimizadas para caber no projeto. Se você gerou imagens com Gemini, baixe a versão original na prévia antes de aplicá-la para guardar a resolução recebida.\n\nCHECKLIST DAS IMAGENS\n${imageChecklist(project).join("\n")}\n\nAntes da publicação, revise os textos, o número de contato e as autorizações de uso de fotos e depoimentos. Este pacote não publica o site automaticamente.\n`;
      const archive = createZip([
        { name: "index.html", content: html },
        { name: "README.txt", content: readme },
        ...assets,
      ]);
      downloadBlob(
        new Blob([new Uint8Array(archive).buffer], { type: "application/zip" }),
        `${project.slug || "meu-site"}.zip`,
      );
      announce("ZIP baixado. Extraia e abra index.html para conferir.");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Não foi possível preparar o ZIP.");
    }
  };
  const previewHtml = () => {
    const html = buildStandaloneHtml(project);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  // The value ensures React re-renders disabled undo/redo controls after history mutations.
  void historyVersion;

  return (
    <div className="sx-studio">
      <header className="sx-studio-toolbar">
        <div className="sx-studio-toolbar-start">
          <button
            type="button"
            className="sx-studio-back"
            aria-label="Voltar aos projetos"
            onClick={onBack}
          >
            <ArrowLeft size={19} />
          </button>
          <div className="sx-studio-divider" />
          <div className="sx-studio-title">
            <strong>{project.business.name}</strong>
            <small>Editor visual</small>
          </div>
          <span className="sx-studio-status" data-status={publicationStatus}>
            {publicationStatus === "published"
              ? "Ativo no ar"
              : publicationStatus === "suspended"
                ? "Suspenso"
                : "Rascunho"}
          </span>
        </div>
        <div className="sx-studio-toolbar-actions">
          <div className="sx-studio-segment" aria-label="Largura da prévia">
            {(
              [
                ["desktop", Monitor, "Computador"],
                ["tablet", Tablet, "Tablet"],
                ["mobile", Smartphone, "Celular"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                type="button"
                key={id}
                title={label}
                aria-label={label}
                aria-pressed={viewport === id}
                data-active={viewport === id}
                onClick={() => setViewport(id)}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
          <label className="sx-studio-toolbar-select">
            <span className="sr-only">Paleta de cores</span>
            <select
              aria-label="Paleta de cores"
              value={project.appearance.paletteId}
              onChange={(event) => {
                const palette = PALETTES[project.archetype].find(
                  (item) => item.id === event.currentTarget.value,
                );
                if (palette) editAppearance({ paletteId: palette.id, palette: palette.value });
              }}
            >
              {PALETTES[project.archetype].map((palette) => (
                <option key={palette.id} value={palette.id}>
                  {palette.name}
                </option>
              ))}
            </select>
          </label>
          <label className="sx-studio-toolbar-select">
            <span className="sr-only">Tipografia</span>
            <select
              aria-label="Tipografia"
              value={project.appearance.headingFont}
              onChange={(event) =>
                editAppearance({
                  headingFont: event.currentTarget
                    .value as SiteProject["appearance"]["headingFont"],
                })
              }
            >
              <option value="editorial">Editorial</option>
              <option value="classic">Clássica</option>
              <option value="modern">Moderna</option>
            </select>
          </label>
          <button
            type="button"
            className="sx-studio-icon"
            aria-label="Desfazer"
            title="Desfazer"
            disabled={past.current.length === 0}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            className="sx-studio-icon"
            aria-label="Refazer"
            title="Refazer"
            disabled={future.current.length === 0}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <div className="sx-studio-divider" />
          <button
            type="button"
            className="sx-studio-button sx-studio-button--light"
            onClick={onSave}
            disabled={!onSave || saveStatus === "saving"}
          >
            {saveStatus === "error"
              ? "Tentar salvar"
              : saveStatus === "saved"
                ? "Salvo"
                : saveStatus === "saving"
                  ? "Salvando…"
                  : "Salvar"}
          </button>
          <button
            type="button"
            className="sx-studio-button sx-studio-button--light"
            onClick={previewHtml}
          >
            <Eye size={15} /> Prévia
          </button>
          {publicSiteHref && (
            <a
              className="sx-studio-button sx-studio-button--light"
              href={publicSiteHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={15} /> Abrir
            </a>
          )}
          {onPublish && (
            <button
              type="button"
              className="sx-studio-button sx-studio-button--light"
              onClick={onPublish}
              disabled={publishDisabled}
            >
              {publicationStatus === "published" ? "Suspender" : "Publicar"}
            </button>
          )}
          <button
            type="button"
            className="sx-studio-icon"
            title="Baixar apenas o HTML"
            aria-label="Baixar apenas o HTML"
            onClick={saveHtml}
          >
            <FileCode2 size={17} />
          </button>
          <button
            type="button"
            className="sx-studio-button sx-studio-button--dark"
            onClick={saveZip}
          >
            <Package size={15} /> Baixar ZIP
          </button>
        </div>
      </header>
      <div className="sx-studio-body">
        <aside className="sx-studio-panel" aria-label="Ferramentas do editor">
          <div className="sx-studio-tabs" role="tablist" aria-label="Ferramentas">
            {(
              [
                ["sections", LayoutGrid, "Seções"],
                ["items", Type, "Itens"],
                ["brand", Palette, "Marca"],
                ["marketing", SearchCheck, "Marketing"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                data-active={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          <div className="sx-studio-panel-scroll">
            {tab === "items" && (
              <>
                <Group title="Sua empresa">
                  <Field
                    label="Nome"
                    value={project.business.name}
                    onCommit={(value) => editBusiness("name", value)}
                  />
                  <Field
                    label="Categoria"
                    value={project.business.category}
                    onCommit={(value) => editBusiness("category", value)}
                    placeholder="Ex.: padaria, clínica, loja"
                  />
                  <Field
                    label="Cidade"
                    value={project.business.city}
                    onCommit={(value) => editBusiness("city", value)}
                  />
                  <Field
                    label="Estado"
                    value={project.business.state}
                    onCommit={(value) => editBusiness("state", value)}
                  />
                </Group>
                <Group title="Primeira dobra">
                  <Field
                    label="Chamada acima do título"
                    value={project.content.eyebrow}
                    onCommit={(value) => editContent("eyebrow", value)}
                  />
                  <Field
                    label="Título principal"
                    value={project.content.heroTitle}
                    onCommit={(value) => editContent("heroTitle", value)}
                    multiline
                  />
                  <Field
                    label="Descrição"
                    value={project.content.heroSubtitle}
                    onCommit={(value) => editContent("heroSubtitle", value)}
                    multiline
                  />
                  {enableAiTools && (
                    <button
                      type="button"
                      className="sx-studio-button sx-studio-button--outline sx-studio-ai-action"
                      disabled={
                        rewritingField !== null || project.content.heroSubtitle.trim().length < 10
                      }
                      onClick={() => void rewriteContent("heroSubtitle")}
                    >
                      <Sparkles size={15} aria-hidden="true" />
                      {rewritingField === "heroSubtitle"
                        ? "Reescrevendo…"
                        : "Melhorar descrição com IA"}
                    </button>
                  )}
                  <Field
                    label="Texto do botão"
                    value={project.content.ctaLabel}
                    onCommit={(value) => editContent("ctaLabel", value)}
                  />
                </Group>
                <Group title="Sobre">
                  <Field
                    label="Título"
                    value={project.content.aboutTitle}
                    onCommit={(value) => editContent("aboutTitle", value)}
                  />
                  <Field
                    label="Sua história"
                    value={project.content.aboutBody}
                    onCommit={(value) => editContent("aboutBody", value)}
                    multiline
                    placeholder="Escreva informações reais sobre o negócio"
                    hint="Se ficar vazio, a seção não entra no arquivo final."
                  />
                  {enableAiTools && (
                    <button
                      type="button"
                      className="sx-studio-button sx-studio-button--outline sx-studio-ai-action"
                      disabled={
                        rewritingField !== null || project.content.aboutBody.trim().length < 10
                      }
                      onClick={() => void rewriteContent("aboutBody")}
                    >
                      <Sparkles size={15} aria-hidden="true" />
                      {rewritingField === "aboutBody"
                        ? "Reescrevendo…"
                        : "Melhorar história com IA"}
                    </button>
                  )}
                </Group>
                <Group title="Serviços e produtos">
                  <Field
                    label="Título da seção"
                    value={project.content.servicesTitle}
                    onCommit={(value) => editContent("servicesTitle", value)}
                  />
                  {project.items.map((item, index) => (
                    <div className="sx-studio-card-edit" key={item.id}>
                      <div className="sx-studio-card-edit-head">
                        <span>Item {index + 1}</span>
                        <button
                          type="button"
                          aria-label={`Remover item ${index + 1}`}
                          onClick={() =>
                            commit({
                              ...project,
                              items: project.items.filter((value) => value.id !== item.id),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <Field
                        label="Nome"
                        value={item.title}
                        onCommit={(value) => updateItem(item.id, { title: value })}
                      />
                      <Field
                        label="Descrição"
                        value={item.description}
                        onCommit={(value) => updateItem(item.id, { description: value })}
                        multiline
                      />
                      <Field
                        label="Preço opcional"
                        value={item.price || ""}
                        onCommit={(value) => updateItem(item.id, { price: value })}
                        placeholder="Ex.: A partir de R$ 40"
                      />
                      <Field
                        label="Categoria para o filtro"
                        value={item.category || ""}
                        onCommit={(value) => updateItem(item.id, { category: value })}
                        placeholder="Ex.: Pratos"
                      />
                      <Field
                        label="Selo opcional"
                        value={item.badge || ""}
                        onCommit={(value) => updateItem(item.id, { badge: value })}
                        placeholder="Ex.: Mais pedido, se confirmado"
                      />
                      {safeImageSrc(item.image) && (
                        <img
                          className="sx-studio-thumb"
                          src={safeImageSrc(item.image)!}
                          alt={`Foto de ${item.title}`}
                        />
                      )}
                      <label className="sx-studio-upload sx-studio-upload--item">
                        <ImagePlus size={18} /> Adicionar foto do item
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(event) => void uploadItemImage(event, item.id)}
                        />
                      </label>
                      <Field
                        label="Ou URL da foto"
                        value={item.image?.startsWith("data:") ? "" : item.image || ""}
                        onCommit={(value) => updateItem(item.id, { image: value })}
                        type="url"
                        placeholder="https://..."
                      />
                      {item.image && (
                        <button
                          type="button"
                          className="sx-studio-button sx-studio-button--danger"
                          onClick={() => updateItem(item.id, { image: "" })}
                        >
                          Remover foto
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="sx-studio-button sx-studio-button--outline"
                    onClick={() =>
                      commit({
                        ...project,
                        items: [
                          ...project.items,
                          { id: uid(), title: "Novo item", description: "" },
                        ],
                      })
                    }
                  >
                    <Plus size={14} /> Adicionar item
                  </button>
                </Group>
                <Group title="Contato">
                  <Field
                    label="Título"
                    value={project.content.contactTitle}
                    onCommit={(value) => editContent("contactTitle", value)}
                  />
                  <Field
                    label="Mensagem"
                    value={project.content.contactBody}
                    onCommit={(value) => editContent("contactBody", value)}
                    multiline
                  />
                  <Field
                    label="WhatsApp com DDD"
                    value={project.business.whatsapp}
                    onCommit={(value) => editBusiness("whatsapp", value)}
                    placeholder="11999999999"
                    hint="O botão só ativa com um número válido."
                  />
                  <Field
                    label="Endereço"
                    value={project.business.address}
                    onCommit={(value) => editBusiness("address", value)}
                  />
                  <Field
                    label="Link do mapa"
                    value={project.business.mapsUrl}
                    onCommit={(value) => editBusiness("mapsUrl", value)}
                    placeholder="https://maps.google.com/..."
                    type="url"
                  />
                </Group>
                <Group title="Dúvidas frequentes">
                  <Field
                    label="Título da seção"
                    value={project.content.faqTitle}
                    onCommit={(value) => editContent("faqTitle", value)}
                  />
                  {project.faqs.map((faq, index) => (
                    <div className="sx-studio-card-edit" key={faq.id}>
                      <div className="sx-studio-card-edit-head">
                        <span>Dúvida {index + 1}</span>
                        <button
                          type="button"
                          aria-label={`Remover dúvida ${index + 1}`}
                          onClick={() =>
                            commit({
                              ...project,
                              faqs: project.faqs.filter((item) => item.id !== faq.id),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <Field
                        label="Pergunta"
                        value={faq.question}
                        onCommit={(value) => updateFaq(faq.id, { question: value })}
                      />
                      <Field
                        label="Resposta"
                        value={faq.answer}
                        onCommit={(value) => updateFaq(faq.id, { answer: value })}
                        multiline
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="sx-studio-button sx-studio-button--outline"
                    onClick={() =>
                      commit({
                        ...project,
                        faqs: [
                          ...project.faqs,
                          { id: uid(), question: "Nova pergunta", answer: "" },
                        ],
                      })
                    }
                  >
                    <Plus size={14} /> Adicionar dúvida
                  </button>
                </Group>
                <Group title="Avaliações reais">
                  <div className="sx-studio-note">
                    Publique apenas depoimentos recebidos de clientes e autorizados para uso.
                  </div>
                  {project.reviews.map((review, index) => (
                    <div className="sx-studio-card-edit" key={review.id}>
                      <div className="sx-studio-card-edit-head">
                        <span>Depoimento {index + 1}</span>
                        <button
                          type="button"
                          aria-label={`Remover depoimento ${index + 1}`}
                          onClick={() =>
                            commit({
                              ...project,
                              reviews: project.reviews.filter((item) => item.id !== review.id),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <Field
                        label="Nome do cliente"
                        value={review.author}
                        onCommit={(value) => updateReview(review.id, { author: value })}
                      />
                      <Field
                        label="Depoimento"
                        value={review.quote}
                        onCommit={(value) => updateReview(review.id, { quote: value })}
                        multiline
                      />
                      <Field
                        label="Origem opcional"
                        value={review.source || ""}
                        onCommit={(value) => updateReview(review.id, { source: value })}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="sx-studio-button sx-studio-button--outline"
                    onClick={() =>
                      commit({
                        ...project,
                        reviews: [...project.reviews, { id: uid(), author: "", quote: "" }],
                      })
                    }
                  >
                    <Plus size={14} /> Adicionar depoimento
                  </button>
                </Group>
                <Group title="Campanha e vídeo">
                  <Field
                    label="Título da campanha"
                    value={project.content.promoTitle}
                    onCommit={(value) => editContent("promoTitle", value)}
                  />
                  <Field
                    label="Condições confirmadas"
                    value={project.content.promoBody}
                    onCommit={(value) => editContent("promoBody", value)}
                    multiline
                  />
                  <Field
                    label="Título do vídeo"
                    value={project.content.videoTitle}
                    onCommit={(value) => editContent("videoTitle", value)}
                  />
                  <Field
                    label="Link do vídeo"
                    value={project.content.videoUrl}
                    onCommit={(value) => editContent("videoUrl", value)}
                    type="url"
                    placeholder="https://..."
                  />
                </Group>
              </>
            )}
            {tab === "sections" && (
              <>
                <Group title="Ordem e visibilidade">
                  <p className="sx-studio-hint" style={{ marginBottom: 16 }}>
                    Ative as partes que deseja mostrar. Use as setas para mudar a ordem.
                  </p>
                  {project.sections.map((section, index) => (
                    <div className="sx-studio-section-row" key={section.id}>
                      <input
                        className="sx-studio-toggle"
                        aria-label={`Mostrar ${SECTION_LABELS[section.id]}`}
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) => updateSection(section.id, event.currentTarget.checked)}
                        disabled={section.id === "hero"}
                      />
                      <strong>{SECTION_LABELS[section.id]}</strong>
                      <button
                        type="button"
                        aria-label={`Mover ${SECTION_LABELS[section.id]} para cima`}
                        disabled={
                          index === 0 ||
                          section.id === "hero" ||
                          project.sections[index - 1]?.id === "hero"
                        }
                        onClick={() => moveSection(index, -1)}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Mover ${SECTION_LABELS[section.id]} para baixo`}
                        disabled={index === project.sections.length - 1 || section.id === "hero"}
                        onClick={() => moveSection(index, 1)}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  ))}
                </Group>
                <div className="sx-studio-note">
                  Seções sem conteúdo real aparecem como orientação no editor e são omitidas do HTML
                  exportado.
                </div>
              </>
            )}
            {tab === "brand" && (
              <>
                <Group title="Estrutura do site">
                  <div className="sx-studio-cards">
                    {(
                      [
                        ["gastronomia", "Gastronomia", "Visual imersivo e acolhedor"],
                        ["servicos", "Serviços", "Editorial e profissional"],
                        ["produtos", "Produtos", "Vitrine moderna"],
                      ] as const
                    ).map(([id, title, description]) => (
                      <button
                        type="button"
                        key={id}
                        className="sx-studio-choice"
                        data-active={project.archetype === id}
                        onClick={() => switchArchetype(id)}
                      >
                        <span className="sx-studio-choice-icon">{archetypeIcon(id)}</span>
                        <span>
                          <strong>{title}</strong>
                          <small>{description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </Group>
                <Group title="Cores">
                  {PALETTES[project.archetype].map((palette) => (
                    <button
                      type="button"
                      key={palette.id}
                      className="sx-studio-palette"
                      data-active={project.appearance.paletteId === palette.id}
                      onClick={() =>
                        editAppearance({ paletteId: palette.id, palette: palette.value })
                      }
                    >
                      <span>{palette.name}</span>
                      <span className="sx-studio-swatches">
                        <i style={{ background: palette.value.primary }} />
                        <i style={{ background: palette.value.secondary }} />
                        <i style={{ background: palette.value.accent }} />
                        <i style={{ background: palette.value.soft }} />
                      </span>
                    </button>
                  ))}
                </Group>
                <Group title="Tipografia">
                  <div className="sx-studio-cards">
                    {(
                      [
                        ["editorial", "Editorial", "Serifada e expressiva"],
                        ["classic", "Clássica", "Elegante e familiar"],
                        ["modern", "Moderna", "Direta e geométrica"],
                      ] as const
                    ).map(([id, title, description]) => (
                      <button
                        type="button"
                        key={id}
                        className="sx-studio-choice"
                        data-active={project.appearance.headingFont === id}
                        onClick={() => editAppearance({ headingFont: id })}
                      >
                        <span>
                          <strong>{title}</strong>
                          <small>{description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </Group>
              </>
            )}
            {tab === "brand" && (
              <>
                <Group title="Foto principal">
                  {photoReference && !project.appearance.heroImage && (
                    <div className="sx-studio-photo-reference">
                      <img src={photoReference} alt="Foto escolhida como referência no Google" />
                      <p>
                        Esta foto do Google é uma referência. Envie uma imagem autorizada abaixo
                        para usar como capa no site publicado e no arquivo exportado.
                      </p>
                    </div>
                  )}
                  <label className="sx-studio-upload">
                    <ImagePlus size={22} />
                    <strong>Escolher imagem</strong>
                    <small>JPG, PNG, WebP ou GIF · até 10 MB · otimização automática</small>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => upload(event, "hero")}
                    />
                  </label>
                  {project.appearance.heroImage && (
                    <>
                      <img
                        className="sx-studio-thumb"
                        src={project.appearance.heroImage}
                        alt="Foto principal"
                      />
                      <button
                        type="button"
                        className="sx-studio-button sx-studio-button--danger"
                        onClick={() =>
                          editAppearance({
                            heroImage: "",
                            heroImageAlt: "",
                            heroImageIllustrative: false,
                          })
                        }
                      >
                        <Trash2 size={13} /> Remover foto
                      </button>
                    </>
                  )}
                  <Field
                    label="Descrição da foto"
                    value={project.appearance.heroImageAlt}
                    onCommit={(value) => editAppearance({ heroImageAlt: value })}
                    hint="Descreva a imagem para leitores de tela."
                  />
                  <div className="sx-studio-field">
                    <label>
                      Foco da imagem
                      <select
                        value={project.appearance.heroPosition}
                        onChange={(event) =>
                          editAppearance({ heroPosition: event.currentTarget.value })
                        }
                      >
                        <option value="50% 50%">Centro</option>
                        <option value="50% 25%">Parte superior</option>
                        <option value="50% 75%">Parte inferior</option>
                        <option value="25% 50%">Esquerda</option>
                        <option value="75% 50%">Direita</option>
                      </select>
                    </label>
                  </div>
                </Group>
                <Group title="Imagens para celular e Sobre">
                  <p className="sx-studio-hint">
                    Use composições próprias para cada tela. Se um campo ficar vazio, o site
                    reaproveita a imagem disponível.
                  </p>
                  {(
                    [
                      [
                        "heroMobile",
                        "Capa para celular",
                        project.appearance.heroImageMobile || "",
                        "heroMobile",
                      ],
                      [
                        "about",
                        "Sobre no computador",
                        project.appearance.aboutImage || "",
                        "aboutDesktop",
                      ],
                      [
                        "aboutMobile",
                        "Sobre no celular",
                        project.appearance.aboutImageMobile || "",
                        "aboutMobile",
                      ],
                    ] as const
                  ).map(([destination, title, image, slot]) => (
                    <div className="sx-studio-extra-image" key={destination}>
                      <strong>{title}</strong>
                      <label className="sx-studio-upload">
                        <ImagePlus size={18} />
                        <span>Enviar foto autorizada</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(event) => upload(event, destination)}
                        />
                      </label>
                      {image && (
                        <>
                          <img src={image} alt={`Prévia: ${title}`} />
                          <button
                            type="button"
                            className="sx-studio-button sx-studio-button--danger"
                            onClick={() => commit(withProjectImage(project, slot, "", "remove", 0))}
                          >
                            Remover
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </Group>
                <Group title="Logotipo">
                  <label className="sx-studio-upload">
                    <ImagePlus size={20} />
                    <strong>Enviar logotipo</strong>
                    <small>Opcional · até 10 MB</small>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => upload(event, "logo")}
                    />
                  </label>
                  {project.business.logoUrl && (
                    <button
                      type="button"
                      className="sx-studio-button sx-studio-button--danger"
                      style={{ marginTop: 10 }}
                      onClick={() => editBusiness("logoUrl", "")}
                    >
                      <Trash2 size={13} /> Remover logotipo
                    </button>
                  )}
                </Group>
                <Group title="Galeria">
                  <label className="sx-studio-upload">
                    <ImagePlus size={20} />
                    <strong>Adicionar foto</strong>
                    <small>Use imagens reais e autorizadas.</small>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => upload(event, "gallery")}
                    />
                  </label>
                  <div className="sx-studio-gallery-thumbs">
                    {project.gallery.map((image, index) => (
                      <div key={`${image.slice(0, 30)}-${index}`}>
                        <img src={image} alt={`Foto ${index + 1}`} />
                        <button
                          type="button"
                          aria-label={`Remover foto ${index + 1}`}
                          onClick={() =>
                            commit({
                              ...project,
                              gallery: project.gallery.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                              galleryIllustrative: project.gallery
                                .map(
                                  (_, itemIndex) =>
                                    project.galleryIllustrative?.[itemIndex] ?? false,
                                )
                                .filter((_, itemIndex) => itemIndex !== index),
                            })
                          }
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </Group>
                {enableAiTools && (
                  <Group title="Imagens com Gemini">
                    <p className="sx-studio-hint">
                      Crie uma foto nova ou melhore uma foto enviada por você. Cada pedido pode
                      consumir sua cota da API. Confira a prévia antes de usar no site.
                    </p>
                    <p className="sx-studio-hint" role="status">
                      {imageIntegration === null
                        ? "Verificando disponibilidade do Gemini…"
                        : imageIntegration.configured
                          ? `Gemini disponível · até ${imageIntegration.dailyLimit} pedidos por dia neste espaço de trabalho.`
                          : "Gemini indisponível neste ambiente. Você pode continuar enviando fotos autorizadas."}
                    </p>
                    <div className="sx-studio-field">
                      <label>
                        Onde usar
                        <select
                          value={imageTarget}
                          onChange={(event) => {
                            setImageTarget(event.currentTarget.value as ImageSlot);
                            setImageProposal(null);
                          }}
                        >
                          <option value="heroDesktop">Capa no computador · 16:9</option>
                          <option value="heroMobile">Capa no celular · 1:1</option>
                          <option value="aboutDesktop">Sobre no computador · 4:3</option>
                          <option value="aboutMobile">Sobre no celular · 4:5</option>
                          <option value="gallery">Galeria · 4:3</option>
                        </select>
                      </label>
                    </div>
                    {imageTarget === "gallery" && project.gallery.length > 0 && (
                      <div className="sx-studio-field">
                        <label>
                          Foto a melhorar
                          <select
                            value={Math.min(imageIndex, project.gallery.length - 1)}
                            onChange={(event) => {
                              setImageIndex(Number(event.currentTarget.value));
                              setImageProposal(null);
                            }}
                          >
                            {project.gallery.map((_, index) => (
                              <option key={index} value={index}>
                                Foto {index + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                    <div className="sx-studio-field">
                      <label>
                        Descrição da imagem desejada
                        <textarea
                          value={imagePrompt}
                          maxLength={2_000}
                          onChange={(event) => setImagePrompt(event.currentTarget.value)}
                          placeholder="Ex.: detalhe ilustrativo de ferramentas genéricas em bancada neutra, com luz suave"
                        />
                      </label>
                    </div>
                    <p className="sx-studio-hint">
                      Para mostrar sua equipe, local ou produto real, envie a foto original e use
                      “Melhorar foto enviada”. Cenas criadas sem foto serão marcadas como
                      ilustrativas.
                    </p>
                    <div className="sx-studio-image-actions">
                      <button
                        type="button"
                        className="sx-studio-button sx-studio-button--outline"
                        disabled={
                          !imageIntegration?.configured ||
                          imageBusy ||
                          (imageTarget === "gallery" && project.gallery.length >= 8)
                        }
                        onClick={() => void requestImage("generate")}
                      >
                        <Sparkles size={14} /> Gerar foto nova
                      </button>
                      <button
                        type="button"
                        className="sx-studio-button sx-studio-button--outline"
                        disabled={
                          !imageIntegration?.configured ||
                          imageBusy ||
                          !projectImageForSlot(project, imageTarget, imageIndex)
                        }
                        onClick={() => void requestImage("enhance")}
                      >
                        <Sparkles size={14} /> Melhorar foto enviada
                      </button>
                    </div>
                    {imageBusy && (
                      <p className="sx-studio-hint" role="status">
                        Preparando imagem…
                      </p>
                    )}
                    {imageProposal && (
                      <div className="sx-studio-image-proposal">
                        <div className="sx-studio-image-comparison">
                          {imageProposal.mode === "enhance" && (
                            <div>
                              <strong>Foto original</strong>
                              <img src={imageProposal.original} alt="Foto original enviada" />
                            </div>
                          )}
                          <div>
                            <strong>Prévia do Gemini</strong>
                            <img src={imageProposal.image} alt="Prévia criada pelo Gemini" />
                          </div>
                        </div>
                        <p>Revise detalhes, pessoas, produtos e identidade antes de aceitar.</p>
                        <div className="sx-studio-image-actions">
                          <button
                            type="button"
                            className="sx-studio-button sx-studio-button--dark"
                            disabled={imageBusy}
                            onClick={() => void acceptImage()}
                          >
                            Usar esta imagem
                          </button>
                          <button
                            type="button"
                            className="sx-studio-button sx-studio-button--outline"
                            onClick={() => void downloadProposedImage()}
                          >
                            Baixar original
                          </button>
                          <button
                            type="button"
                            className="sx-studio-button sx-studio-button--light"
                            disabled={imageBusy}
                            onClick={() => setImageProposal(null)}
                          >
                            Descartar
                          </button>
                        </div>
                      </div>
                    )}
                  </Group>
                )}
              </>
            )}
            {tab === "marketing" && (
              <>
                <Group title="Como o site aparece nas buscas">
                  <p className="sx-studio-hint">
                    Estes textos aparecem nos resultados de busca e na prévia de links. Escreva
                    apenas informações confirmadas sobre o negócio.
                  </p>
                  <Field
                    label="Título para buscadores"
                    value={project.marketing?.seoTitle || ""}
                    onCommit={(value) => editMarketing({ seoTitle: value.slice(0, 70) })}
                    placeholder={`${project.business.name} — ${project.business.city || "Site oficial"}`}
                    hint="Até 70 caracteres. Se vazio, usamos o nome da empresa."
                  />
                  <Field
                    label="Descrição para buscadores"
                    value={project.marketing?.seoDescription || ""}
                    onCommit={(value) => editMarketing({ seoDescription: value.slice(0, 170) })}
                    multiline
                    placeholder={project.content.heroSubtitle}
                    hint="Até 170 caracteres. Se vazio, usamos a descrição do site."
                  />
                </Group>
              </>
            )}
          </div>
        </aside>
        <main className="sx-studio-canvas-area">
          <div className="sx-studio-canvas-top">
            <div>
              <strong>Prévia ao vivo</strong>
              <small>Clique no texto para editar diretamente</small>
            </div>
          </div>
          <div className="sx-canvas-viewport" data-viewport={viewport}>
            <SitePreview
              project={project}
              editable
              previewViewport={viewport}
              selectedField={selectedField}
              onSelectField={setSelectedField}
              onEditField={editField}
              onSelectImage={() => setTab("brand")}
            />
          </div>
          <div className="sx-studio-canvas-bottom">
            <span>
              {viewport === "desktop"
                ? "Computador"
                : viewport === "tablet"
                  ? "Tablet · 768 px"
                  : "Celular · 390 px"}
            </span>
            <span>
              Seu conteúdo fica salvo no projeto. Baixe o HTML para hospedar em outro lugar.
            </span>
          </div>
        </main>
      </div>
      {toast && (
        <div className="sx-studio-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
