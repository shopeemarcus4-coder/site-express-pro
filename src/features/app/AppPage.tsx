import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  CircleAlert,
  ExternalLink,
  FileText,
  Globe2,
  LayoutTemplate,
  LoaderCircle,
  LogOut,
  MoonStar,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  ContractsPage,
  contractsStateFromWorkspace,
  mergeContractsStateIntoWorkspace,
} from "../contracts";
import { createSiteProject, slugify } from "../studio/presets";
import { StudioPage } from "../studio/StudioPage";
import type { SiteArchetype, SiteProject } from "../studio/types";
import {
  DEMO_STORAGE_KEY,
  emptyWorkspace,
  loadLocalWorkspace,
  uniqueSlug,
  type AppWorkspace,
  type SiteRecord,
} from "./workspace";
import { placeDetailsDraft, type PlaceSearchResult } from "./places";
import "../../styles/app.css";
import { Logo } from "../../components/site/Logo";

type Mode = "loading" | "choose" | "local" | "account";
type View = "dashboard" | "studio" | "contracts";
type SaveStatus = "saved" | "pending" | "saving" | "error";
type User = { id: string; organizationId: string; name: string; email: string };

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorText(body: Record<string, unknown>, fallback: string): string {
  return typeof body["error"] === "string" ? body["error"] : fallback;
}

const archetypeLabels: Record<SiteArchetype, string> = {
  gastronomia: "Gastronomia",
  servicos: "Serviços",
  produtos: "Produtos",
};

export function AppPage() {
  const [mode, setMode] = useState<Mode>("loading");
  const [view, setView] = useState<View>("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<AppWorkspace>(emptyWorkspace);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState("");
  const [authTab, setAuthTab] = useState<"register" | "login">("register");
  const [authBusy, setAuthBusy] = useState(false);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    organizationName: "",
  });
  const [newSite, setNewSite] = useState({
    name: "",
    category: "",
    city: "",
    address: "",
    phone: "",
    website: "",
    mapsUrl: "",
    archetype: "servicos" as SiteArchetype,
  });
  const [siteQuery, setSiteQuery] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [placesBusy, setPlacesBusy] = useState(false);
  const [placesMessage, setPlacesMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const versionRef = useRef(0);
  const pendingRef = useRef<AppWorkspace | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeSelectionRef = useRef(0);
  const createDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCreate) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    createDialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowCreate(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [showCreate]);

  function editNewSite(changes: Partial<typeof newSite>) {
    // A late details response must not replace a field the user has already edited.
    placeSelectionRef.current += 1;
    setNewSite((current) => ({ ...current, ...changes }));
  }

  const loadAccountWorkspace = useCallback(async (nextUser: User) => {
    const response = await fetch("/api/workspace", { credentials: "same-origin" });
    const body = await responseBody(response);
    if (!response.ok)
      throw new Error(
        errorText(body, "O banco de dados da conta ainda não está disponível nesta hospedagem."),
      );
    versionRef.current = Number(body["version"] ?? 0);
    setWorkspace(body["workspace"] as AppWorkspace);
    setUser(nextUser);
    setMode("account");
    setSaveStatus("saved");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setMode("choose");
          return;
        }
        const body = await responseBody(response);
        if (body["user"]) await loadAccountWorkspace(body["user"] as User);
        else setMode("choose");
      })
      .catch(() => {
        if (active) setMode("choose");
      });
    return () => {
      active = false;
    };
  }, [loadAccountWorkspace]);

  const saveSnapshot = useCallback(async (snapshot: AppWorkspace): Promise<boolean> => {
    try {
      const response = await fetch("/api/workspace", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseVersion: versionRef.current, workspace: snapshot }),
      });
      const body = await responseBody(response);
      if (!response.ok)
        throw new Error(
          errorText(
            body,
            response.status === 409
              ? "Os dados foram alterados em outra aba. Recarregue antes de continuar."
              : "Não foi possível salvar sua conta.",
          ),
        );
      versionRef.current = Number(body["version"] ?? versionRef.current + 1);
      return true;
    } catch (reason) {
      setSaveStatus("error");
      setMessage(
        reason instanceof Error ? reason.message : "Não foi possível salvar. Confira sua conexão.",
      );
      return false;
    }
  }, []);

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (savePromiseRef.current) {
      const success = await savePromiseRef.current;
      if (!success) return false;
    }
    const snapshot = pendingRef.current;
    if (!snapshot) return true;
    pendingRef.current = null;
    setSaveStatus("saving");
    const operation = saveSnapshot(snapshot);
    savePromiseRef.current = operation;
    const success = await operation;
    savePromiseRef.current = null;
    if (!success) {
      pendingRef.current ??= snapshot;
      return false;
    }
    if (pendingRef.current) return flushSave();
    setSaveStatus("saved");
    return true;
  }, [saveSnapshot]);

  const updateWorkspace = useCallback(
    (next: AppWorkspace) => {
      setWorkspace(next);
      if (mode === "local") {
        try {
          localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
          setSaveStatus("saved");
        } catch {
          setSaveStatus("error");
          setMessage("O navegador ficou sem espaço. Exporte o site antes de sair desta página.");
        }
        return;
      }
      if (mode === "account") {
        pendingRef.current = next;
        setSaveStatus("pending");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void flushSave();
        }, 700);
      }
    },
    [mode, flushSave],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function enterLocal() {
    setWorkspace(loadLocalWorkspace());
    setMode("local");
    setView("dashboard");
    setMessage("");
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setMessage("");
    try {
      const payload =
        authTab === "register"
          ? {
              name: authForm.name.trim(),
              email: authForm.email.trim(),
              password: authForm.password,
              organizationName: authForm.organizationName.trim() || authForm.name.trim(),
            }
          : { email: authForm.email.trim(), password: authForm.password };
      const response = await fetch(`/api/auth/${authTab}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await responseBody(response);
      if (!response.ok)
        throw new Error(
          errorText(
            body,
            "A conta não está disponível agora. Você pode continuar neste navegador.",
          ),
        );
      await loadAccountWorkspace(body["user"] as User);
      setAuthForm((current) => ({ ...current, password: "" }));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    if (saveStatus === "pending" || saveStatus === "saving" || saveStatus === "error") {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!(await flushSave())) return;
    }
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body = await responseBody(response);
        throw new Error(errorText(body, "Não foi possível encerrar a sessão. Tente novamente."));
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível encerrar a sessão.");
      return;
    }
    setUser(null);
    setWorkspace(emptyWorkspace());
    setSelectedId(null);
    setView("dashboard");
    setMode("choose");
  }

  async function deleteSite(site: SiteRecord) {
    const next: AppWorkspace = {
      ...workspace,
      sites: workspace.sites.filter((entry) => entry.id !== site.id),
      contracts: workspace.contracts.map((contract) =>
        contract["siteId"] === site.id ? { ...contract, siteId: null } : contract,
      ),
    };
    if (mode === "account") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setActionBusy(true);
      if (!(await flushSave()) || !(await saveSnapshot(next))) {
        setActionBusy(false);
        return;
      }
      setActionBusy(false);
    }
    if (mode === "local") updateWorkspace(next);
    else {
      setWorkspace(next);
      setSaveStatus("saved");
    }
    setDeleteConfirmId(null);
    setMessage(`Projeto “${site.title}” excluído. Os contratos relacionados foram preservados.`);
  }

  function duplicateSite(site: SiteRecord) {
    if (!site.publicData) return;
    const id = crypto.randomUUID();
    const title = `${site.title} — cópia`;
    const slug = uniqueSlug(slugify(title), workspace.sites);
    const now = new Date().toISOString();
    const business = workspace.businesses.find((entry) => entry.id === site.businessId);
    updateWorkspace({
      ...workspace,
      businesses: business
        ? [...workspace.businesses, { ...business, id, name: title }]
        : workspace.businesses,
      sites: [
        ...workspace.sites,
        {
          ...site,
          id,
          title,
          slug,
          businessId: id,
          status: "draft",
          publicData: {
            ...site.publicData,
            id,
            name: title,
            slug,
            createdAt: now,
            updatedAt: now,
            business: { ...site.publicData.business, name: title },
          },
        },
      ],
    });
    setMessage(`Cópia de “${site.title}” criada como rascunho.`);
  }

  function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newSite.name.trim();
    if (!name) {
      setMessage("Informe o nome do negócio para criar o site.");
      return;
    }
    const project = createSiteProject({
      name,
      category: newSite.category.trim(),
      city: newSite.city.trim(),
      address: newSite.address.trim(),
      mapsUrl: newSite.mapsUrl.trim(),
      archetype: newSite.archetype,
      isDemo: mode === "local",
    });
    project.slug = uniqueSlug(slugify(name), workspace.sites);
    const site: SiteRecord = {
      id: project.id,
      title: name,
      slug: project.slug,
      status: "draft",
      businessId: project.id,
      publicData: project,
    };
    updateWorkspace({
      ...workspace,
      businesses: [
        ...workspace.businesses,
        {
          id: project.id,
          name,
          category: project.business.category,
          city: project.business.city,
          address: project.business.address,
          mapsUrl: project.business.mapsUrl,
          phone: newSite.phone.trim(),
          website: newSite.website.trim(),
        },
      ],
      sites: [...workspace.sites, site],
    });
    setSelectedId(project.id);
    setView("studio");
    setShowCreate(false);
    setMessage("");
    placeSelectionRef.current += 1;
    setNewSite({
      name: "",
      category: "",
      city: "",
      address: "",
      phone: "",
      website: "",
      mapsUrl: "",
      archetype: "servicos",
    });
  }

  function editProject(project: SiteProject) {
    const sites = workspace.sites.map((site) =>
      site.id === project.id
        ? { ...site, title: project.name, publicData: { ...project, slug: site.slug } }
        : site,
    );
    const businesses = workspace.businesses.map((business) =>
      business.id === project.id
        ? {
            ...business,
            name: project.business.name,
            category: project.business.category,
            city: project.business.city,
          }
        : business,
    );
    updateWorkspace({ ...workspace, sites, businesses });
  }

  async function setPublication(site: SiteRecord, status: "published" | "suspended") {
    if (mode !== "account" || !site.publicData) return;
    if (status === "published") {
      const contact = site.publicData.business;
      const hasPhone = contact.whatsapp.replace(/\D/g, "").length >= 10;
      const hasAddress = Boolean(contact.address.trim());
      const hasMap = /^https?:\/\//i.test(contact.mapsUrl);
      if (!hasPhone && !hasAddress && !hasMap) {
        setMessage(
          "Adicione ao menos um contato válido (WhatsApp, endereço ou mapa) antes de publicar.",
        );
        return;
      }
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setActionBusy(true);
    setMessage("");
    try {
      if (!(await flushSave())) return;
      const next = {
        ...workspace,
        sites: workspace.sites.map((entry) =>
          entry.id === site.id ? { ...entry, status } : entry,
        ),
      };
      setSaveStatus("saving");
      if (!(await saveSnapshot(next))) return;
      setWorkspace(next);
      setSaveStatus("saved");
      setMessage(
        status === "published"
          ? "Site publicado. Abra o link para conferir a versão pública."
          : "Publicação suspensa.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function searchPlaces(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!placeQuery.trim()) return;
    setPlacesBusy(true);
    setPlacesMessage("");
    setPlaceResults([]);
    try {
      const response = await fetch("/api/places/search", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: placeQuery.trim() }),
      });
      const body = await responseBody(response);
      if (!response.ok)
        throw new Error(
          errorText(body, "Busca externa indisponível. Preencha os dados manualmente."),
        );
      setPlaceResults(
        Array.isArray(body["results"]) ? (body["results"] as PlaceSearchResult[]) : [],
      );
      if (!Array.isArray(body["results"]) || body["results"].length === 0)
        setPlacesMessage("Nenhuma empresa encontrada. Você pode preencher os dados manualmente.");
    } catch (reason) {
      setPlacesMessage(
        reason instanceof Error ? reason.message : "Busca indisponível. Preencha manualmente.",
      );
    } finally {
      setPlacesBusy(false);
    }
  }

  async function selectPlace(place: PlaceSearchResult) {
    const requestId = ++placeSelectionRef.current;
    setNewSite((current) => ({
      ...current,
      name: place.name,
      category: place.category ?? "",
      address: place.address,
      phone: "",
      website: "",
      mapsUrl: "",
    }));
    setPlaceResults([]);
    setPlacesMessage("Dados encontrados no Google. Confira com a empresa antes de criar.");
    try {
      const response = await fetch("/api/places/details", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: place.placeId }),
      });
      const body = await responseBody(response);
      if (!response.ok)
        throw new Error(errorText(body, "Detalhes indisponíveis; revise os campos manualmente."));
      const details = placeDetailsDraft(body["business"], place);
      if (!details)
        throw new Error("Os detalhes recebidos não correspondem à empresa selecionada.");
      if (placeSelectionRef.current !== requestId) return;
      setNewSite((current) => ({ ...current, ...details }));
    } catch {
      if (placeSelectionRef.current === requestId)
        setPlacesMessage(
          "Os detalhes da empresa não foram carregados. Confira os campos manualmente.",
        );
    }
  }

  const activeSite = workspace.sites.find((site) => site.id === selectedId);
  const sites = workspace.sites.filter(
    (site) =>
      site.publicData &&
      (!siteQuery ||
        `${site.title} ${site.slug}`
          .toLocaleLowerCase("pt-BR")
          .includes(siteQuery.toLocaleLowerCase("pt-BR"))),
  );

  if (mode === "loading")
    return (
      <main className="sx-app-loading">
        <LoaderCircle className="sx-spin" />
        <p>Abrindo seu espaço de trabalho…</p>
      </main>
    );

  if (mode === "choose")
    return (
      <main className="sx-app-auth">
        <div className="sx-app-auth__top">
          <a href="/" className="sx-app-brand">
            <Logo />
          </a>
          <a href="/" className="sx-app-back">
            <ArrowLeft size={16} /> Voltar ao início
          </a>
        </div>
        <div className="sx-app-auth__layout">
          <section className="sx-app-auth__intro">
            <span className="sx-app-kicker">SEU ESPAÇO CRIATIVO</span>
            <h1>Do primeiro nome à página pronta.</h1>
            <p>
              Escolha um modelo, ajuste os detalhes e exporte seu site. Você pode começar agora
              mesmo neste navegador.
            </p>
            <div className="sx-app-auth__highlights">
              <span>
                <Check size={17} /> Editor visual
              </span>
              <span>
                <Check size={17} /> Modelos flexíveis
              </span>
              <span>
                <Check size={17} /> Exportação HTML
              </span>
            </div>
          </section>
          <section className="sx-app-auth__card">
            <div className="sx-app-auth__tabs">
              <button
                type="button"
                className={authTab === "register" ? "is-active" : ""}
                onClick={() => setAuthTab("register")}
              >
                Criar conta
              </button>
              <button
                type="button"
                className={authTab === "login" ? "is-active" : ""}
                onClick={() => setAuthTab("login")}
              >
                Entrar
              </button>
            </div>
            <form onSubmit={submitAuth}>
              {authTab === "register" && (
                <>
                  <label>
                    Seu nome
                    <input
                      value={authForm.name}
                      onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                      required
                      minLength={2}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Nome do espaço de trabalho
                    <input
                      value={authForm.organizationName}
                      onChange={(event) =>
                        setAuthForm({ ...authForm, organizationName: event.target.value })
                      }
                      placeholder="Ex.: Minha agência"
                    />
                  </label>
                </>
              )}
              <label>
                E-mail
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  required
                  minLength={authTab === "register" ? 12 : 1}
                  autoComplete={authTab === "register" ? "new-password" : "current-password"}
                />
              </label>
              {authTab === "register" && <small>Use pelo menos 12 caracteres.</small>}
              <button className="sx-app-primary" disabled={authBusy}>
                {authBusy
                  ? "Aguarde…"
                  : authTab === "register"
                    ? "Criar meu espaço"
                    : "Entrar no meu espaço"}
                <ArrowRight size={17} />
              </button>
            </form>
            {message && (
              <p className="sx-app-alert" role="alert">
                <CircleAlert size={17} />
                {message}
              </p>
            )}
            <div className="sx-app-auth__divider">
              <span>ou</span>
            </div>
            <button
              type="button"
              className="sx-app-secondary sx-app-auth__local"
              onClick={enterLocal}
            >
              Continuar neste navegador <ArrowRight size={17} />
            </button>
            <p className="sx-app-auth__note">
              Neste navegador, os rascunhos ficam salvos apenas aqui. Para usar uma conta em vários
              dispositivos, a hospedagem precisa ter banco de dados configurado.
            </p>
          </section>
        </div>
      </main>
    );

  return (
    <main className="sx-app">
      <aside className="sx-app-sidebar">
        <button
          type="button"
          className="sx-app-brand"
          aria-label="Novo Site"
          onClick={() => {
            setView("dashboard");
            setShowCreate(false);
          }}
        >
          <Logo />
        </button>
        <nav aria-label="Navegação do aplicativo">
          <button
            type="button"
            className={view === "dashboard" ? "is-active" : ""}
            onClick={() => {
              setView("dashboard");
              setShowCreate(false);
            }}
          >
            <Plus size={18} /> Novo Site
          </button>
          <button
            type="button"
            onClick={() => {
              setView("dashboard");
              document.getElementById("sx-projects")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <LayoutTemplate size={18} /> Meus Clientes
          </button>
          <button
            type="button"
            className={view === "contracts" ? "is-active" : ""}
            onClick={() => setView("contracts")}
          >
            <FileText size={18} /> Contratos
          </button>
        </nav>
        <div className="sx-app-sidebar__bottom">
          <p>{mode === "local" ? "Espaço local" : user?.name}</p>
          <small>{mode === "local" ? "Salvo neste navegador" : user?.email}</small>
          <button
            type="button"
            onClick={() =>
              mode === "local" ? (setMode("choose"), setView("dashboard")) : void logout()
            }
          >
            <LogOut size={16} /> {mode === "local" ? "Sair deste espaço" : "Sair da conta"}
          </button>
        </div>
      </aside>
      <div className="sx-app-main">
        <header className="sx-app-header">
          <div>
            <span className="sx-app-kicker">
              SITE EXPRESS /{" "}
              {view === "studio" ? "EDITOR" : view === "contracts" ? "CONTRATOS" : "PROJETOS"}
            </span>
            <h1>
              {view === "studio"
                ? (activeSite?.title ?? "Editor")
                : view === "contracts"
                  ? "Clientes e contratos"
                  : "Novo Site"}
            </h1>
          </div>
          <div className="sx-app-header__actions">
            <span className={`sx-app-save sx-app-save--${saveStatus}`} aria-live="polite">
              {saveStatus === "saved" ? (
                <Check size={15} />
              ) : saveStatus === "error" ? (
                <CircleAlert size={15} />
              ) : (
                <LoaderCircle size={15} className="sx-spin" />
              )}
              {saveStatus === "saved"
                ? "Salvo"
                : saveStatus === "pending"
                  ? "Alterações pendentes"
                  : saveStatus === "saving"
                    ? "Salvando"
                    : "Falha ao salvar"}
            </span>
            {mode === "account" && saveStatus === "error" && (
              <button type="button" className="sx-app-secondary" onClick={() => void flushSave()}>
                Tentar salvar
              </button>
            )}
            {view === "studio" && (
              <button
                type="button"
                className="sx-app-secondary"
                onClick={() => setView("dashboard")}
              >
                <ArrowLeft size={16} /> Projetos
              </button>
            )}
          </div>
        </header>
        {message && (
          <div className="sx-app-banner" role="status">
            <CircleAlert size={18} />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        )}
        {mode === "local" && (
          <div className="sx-app-local-note">
            <MoonStar size={17} /> Modo local: seus sites e contratos ficam somente neste navegador.
            Exporte o HTML no editor para guardar uma cópia.
          </div>
        )}
        {view === "contracts" ? (
          <ContractsPage
            value={contractsStateFromWorkspace(workspace)}
            onChange={(next) => updateWorkspace(mergeContractsStateIntoWorkspace(workspace, next))}
            onBack={() => setView("dashboard")}
          />
        ) : view === "studio" && activeSite?.publicData ? (
          <>
            <div className="sx-app-publishbar">
              <div>
                <span>
                  {activeSite.status === "published" && saveStatus === "saved"
                    ? "Publicado"
                    : activeSite.status === "suspended"
                      ? "Publicação suspensa"
                      : "Rascunho"}
                </span>
                <p>
                  {mode === "local"
                    ? "Exporte o HTML para publicar em sua hospedagem."
                    : "Revise o conteúdo antes de publicar."}
                </p>
              </div>
              <div>
                {activeSite.status === "published" && saveStatus === "saved" && (
                  <a
                    href={`/site/${activeSite.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sx-app-secondary"
                  >
                    Abrir site <ExternalLink size={16} />
                  </a>
                )}
                {mode === "account" && (
                  <button
                    type="button"
                    className="sx-app-primary"
                    disabled={actionBusy || saveStatus === "error"}
                    onClick={() =>
                      void setPublication(
                        activeSite,
                        activeSite.status === "published" ? "suspended" : "published",
                      )
                    }
                  >
                    {actionBusy
                      ? "Aguarde…"
                      : activeSite.status === "published"
                        ? "Suspender"
                        : "Publicar site"}
                    <Globe2 size={17} />
                  </button>
                )}
              </div>
            </div>
            <StudioPage
              key={activeSite.id}
              project={activeSite.publicData}
              onChange={editProject}
              onBack={() => setView("dashboard")}
            />
          </>
        ) : (
          <>
            <section className="sx-app-search-home">
              <span className="sx-app-search-home__badge">
                <span /> {mode === "account" ? "BUSCA DE EMPRESAS" : "CRIAÇÃO NO SEU NAVEGADOR"}
              </span>
              <h2>
                Digite a empresa.
                <br />
                Receba o <em>site pronto.</em>
              </h2>
              <p>
                Encontre os dados do negócio, confira as informações e crie uma página pronta para
                personalizar, publicar ou exportar.
              </p>
              {mode === "account" ? (
                <>
                  <form
                    className="sx-app-search-home__form"
                    onSubmit={(event) => void searchPlaces(event)}
                  >
                    <Search size={22} aria-hidden="true" />
                    <input
                      aria-label="Nome da empresa e cidade"
                      value={placeQuery}
                      onChange={(event) => setPlaceQuery(event.target.value)}
                      placeholder="Nome da empresa e cidade"
                    />
                    <button type="submit" disabled={placesBusy}>
                      {placesBusy ? "Buscando…" : "Buscar empresa"} <ArrowRight size={17} />
                    </button>
                  </form>
                  <button
                    type="button"
                    className="sx-app-search-home__manual"
                    onClick={() => setShowCreate(true)}
                  >
                    Criar com dados manuais <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="sx-app-primary"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus size={18} /> Criar site agora
                </button>
              )}
              {placesMessage && (
                <p className="sx-app-search-home__message" role="status">
                  {placesMessage}
                </p>
              )}
              {placeResults.length > 0 && (
                <div className="sx-app-search-home__results" aria-label="Empresas encontradas">
                  {placeResults.map((place) => (
                    <button
                      key={place.placeId}
                      type="button"
                      onClick={() => {
                        setShowCreate(true);
                        void selectPlace(place);
                      }}
                    >
                      <strong>{place.name}</strong>
                      <span>{place.address}</span>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
              )}
              <div className="sx-app-search-home__features">
                <article>
                  <UtensilsCrossed size={20} />
                  <strong>Gastronomia artesanal</strong>
                  <span>Cardápio, galeria e pedido direto.</span>
                </article>
                <article>
                  <Stethoscope size={20} />
                  <strong>Serviços & autoridade</strong>
                  <span>Especialidades, história e contato.</span>
                </article>
                <article>
                  <ShoppingBag size={20} />
                  <strong>Produtos & vitrine</strong>
                  <span>Catálogo visual e conversão.</span>
                </article>
              </div>
            </section>
            <section className="sx-app-projects" id="sx-projects">
              <div className="sx-app-section-heading">
                <div>
                  <span className="sx-app-kicker">MEUS CLIENTES</span>
                  <h2>
                    Sites gerados{" "}
                    <em>{workspace.sites.filter((site) => site.publicData).length}</em>
                  </h2>
                </div>
                <label className="sx-app-search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar sites"
                    value={siteQuery}
                    onChange={(event) => setSiteQuery(event.target.value)}
                    placeholder="Buscar projeto"
                  />
                </label>
              </div>
              {showCreate && (
                <div
                  className="sx-app-create-overlay"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowCreate(false);
                  }}
                >
                  <div
                    ref={createDialogRef}
                    tabIndex={-1}
                    className="sx-app-create"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Criar novo site"
                  >
                    <button
                      type="button"
                      className="sx-app-create__close"
                      aria-label="Fechar"
                      onClick={() => setShowCreate(false)}
                    >
                      <X size={20} />
                    </button>
                    <div>
                      <span className="sx-app-kicker">NOVO PROJETO</span>
                      <h3>Fale um pouco sobre o negócio.</h3>
                      <p>Você pode completar ou mudar tudo no editor.</p>
                    </div>
                    {mode === "account" && (
                      <form
                        className="sx-app-place-search"
                        onSubmit={(event) => void searchPlaces(event)}
                      >
                        <label>
                          Buscar empresa cadastrada
                          <input
                            value={placeQuery}
                            onChange={(event) => setPlaceQuery(event.target.value)}
                            placeholder="Nome e cidade"
                          />
                        </label>
                        <button type="submit" className="sx-app-secondary" disabled={placesBusy}>
                          <Search size={16} />
                          {placesBusy ? "Buscando…" : "Buscar"}
                        </button>
                        {placesMessage && <small>{placesMessage}</small>}
                        {placeResults.length > 0 && (
                          <div className="sx-app-place-results">
                            {placeResults.map((place) => (
                              <button
                                key={place.placeId}
                                type="button"
                                onClick={() => void selectPlace(place)}
                              >
                                <strong>{place.name}</strong>
                                <span>{place.address}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </form>
                    )}
                    <form className="sx-app-create__form" onSubmit={createSite}>
                      <label>
                        Nome do negócio
                        <input
                          value={newSite.name}
                          onChange={(event) => editNewSite({ name: event.target.value })}
                          required
                          placeholder="Ex.: Estúdio Aurora"
                        />
                      </label>
                      <label>
                        Segmento
                        <input
                          value={newSite.category}
                          onChange={(event) => editNewSite({ category: event.target.value })}
                          placeholder="Ex.: Arquitetura"
                        />
                      </label>
                      <label>
                        Cidade
                        <input
                          value={newSite.city}
                          onChange={(event) => editNewSite({ city: event.target.value })}
                          placeholder="Ex.: São Paulo"
                        />
                      </label>
                      <label>
                        Endereço (opcional)
                        <input
                          value={newSite.address}
                          onChange={(event) => editNewSite({ address: event.target.value })}
                          placeholder="Rua, número, bairro"
                        />
                      </label>
                      <label>
                        Telefone comercial (opcional)
                        <input
                          type="tel"
                          value={newSite.phone}
                          onChange={(event) => editNewSite({ phone: event.target.value })}
                          placeholder="Não será tratado como WhatsApp"
                        />
                      </label>
                      <label>
                        Site atual da empresa (opcional)
                        <input
                          type="url"
                          value={newSite.website}
                          onChange={(event) => editNewSite({ website: event.target.value })}
                          placeholder="https://exemplo.com.br"
                        />
                      </label>
                      <label>
                        Link do mapa (opcional)
                        <input
                          type="url"
                          value={newSite.mapsUrl}
                          onChange={(event) => editNewSite({ mapsUrl: event.target.value })}
                          placeholder="https://www.google.com/maps/..."
                        />
                      </label>
                      <label>
                        Modelo inicial
                        <select
                          value={newSite.archetype}
                          onChange={(event) =>
                            editNewSite({ archetype: event.target.value as SiteArchetype })
                          }
                        >
                          <option value="servicos">Serviços</option>
                          <option value="gastronomia">Gastronomia</option>
                          <option value="produtos">Produtos</option>
                        </select>
                      </label>
                      <div className="sx-app-create__actions">
                        <button
                          type="button"
                          className="sx-app-secondary"
                          onClick={() => {
                            placeSelectionRef.current += 1;
                            setShowCreate(false);
                          }}
                        >
                          Cancelar
                        </button>
                        <button type="submit" className="sx-app-primary">
                          Criar site <ArrowRight size={17} />
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              {sites.length ? (
                <div className="sx-app-site-grid">
                  {sites.map((site) => (
                    <article key={site.id} className="sx-app-site-card">
                      <div
                        className={`sx-app-site-card__preview sx-app-site-card__preview--${site.publicData?.archetype ?? "servicos"}`}
                      >
                        <span>
                          {site.publicData?.business.category ||
                            archetypeLabels[site.publicData?.archetype ?? "servicos"]}
                        </span>
                        <strong>{site.publicData?.content.heroTitle}</strong>
                        <small>{site.title}</small>
                      </div>
                      <div className="sx-app-site-card__body">
                        <span className="sx-app-site-card__status">
                          {site.status === "published"
                            ? "Publicado"
                            : site.status === "suspended"
                              ? "Suspenso"
                              : "Rascunho"}
                        </span>
                        <h3>{site.title}</h3>
                        <p>
                          {archetypeLabels[site.publicData?.archetype ?? "servicos"]} ·{" "}
                          {site.publicData?.business.city || "Local não informado"}
                        </p>
                        <div className="sx-app-site-card__actions">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(site.id);
                              setView("studio");
                            }}
                          >
                            Abrir editor <ArrowRight size={17} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Duplicar ${site.title}`}
                            title="Duplicar"
                            onClick={() => duplicateSite(site)}
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Excluir ${site.title}`}
                            onClick={() => setDeleteConfirmId(site.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        {mode === "account" && (
                          <button
                            type="button"
                            className="sx-app-site-card__publish"
                            disabled={actionBusy || saveStatus === "error"}
                            onClick={() =>
                              void setPublication(
                                site,
                                site.status === "published" ? "suspended" : "published",
                              )
                            }
                          >
                            <span
                              className={site.status === "published" ? "is-on" : ""}
                              aria-hidden="true"
                            />
                            {site.status === "published"
                              ? "No ar · suspender"
                              : "Fora do ar · publicar"}
                          </button>
                        )}
                        {deleteConfirmId === site.id && (
                          <div className="sx-app-site-card__confirm">
                            <p>Excluir este projeto? Contratos existentes serão preservados.</p>
                            <button type="button" onClick={() => setDeleteConfirmId(null)}>
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() => void deleteSite(site)}
                            >
                              Excluir projeto
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="sx-app-empty">
                  <Sparkles size={24} />
                  <h3>{siteQuery ? "Nenhum site encontrado" : "Seu espaço está pronto"}</h3>
                  <p>
                    {siteQuery
                      ? "Tente buscar por outro nome."
                      : "Crie seu primeiro site e comece a dar forma às suas ideias."}
                  </p>
                  {!siteQuery && (
                    <button
                      type="button"
                      className="sx-app-secondary"
                      onClick={() => setShowCreate(true)}
                    >
                      Criar meu primeiro site <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
