import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  CircleAlert,
  LoaderCircle,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { createSiteProject, slugify } from "../studio/presets";
import { StudioPage } from "../studio/StudioPage";
import { optimizeImage } from "../studio/optimizeImage";
import type { SiteArchetype, SiteProject } from "../studio/types";
import {
  DEMO_STORAGE_KEY,
  emptyWorkspace,
  loadLocalWorkspace,
  uniqueSlug,
  type AppWorkspace,
  type SiteRecord,
} from "./workspace";
import {
  placeDetailsDraft,
  placePhotoUrl,
  placeTemplate,
  type ImportedPlaceDetails,
  type PlacePhoto,
  type PlaceSearchResult,
} from "./places";
import "../../styles/app.css";
import { Logo } from "../../components/site/Logo";

type View = "dashboard" | "studio";
type SaveStatus = "saved" | "error";

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
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [workspace, setWorkspace] = useState<AppWorkspace>(emptyWorkspace);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState("");
  const [placesAvailability, setPlacesAvailability] = useState<{
    configured: boolean;
    availableWithoutAccount: boolean;
    photosEnabled: boolean;
    reviewsEnabled: boolean;
    contactFieldsEnabled: boolean;
  } | null>(null);
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
  const [placePhotos, setPlacePhotos] = useState<PlacePhoto[]>([]);
  const [placeDetails, setPlaceDetails] = useState<ImportedPlaceDetails | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [selectedPhotoName, setSelectedPhotoName] = useState<string | null>(null);
  const [photoReference, setPhotoReference] = useState<{
    siteId: string;
    photo: PlacePhoto;
  } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const placeSelectionRef = useRef(0);
  const placeSearchRef = useRef(0);
  const placeSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeSearchAbortRef = useRef<AbortController | null>(null);
  const placeSearchCacheRef = useRef(new Map<string, PlaceSearchResult[]>());
  const createDialogRef = useRef<HTMLDivElement>(null);
  const closeCreate = useCallback(() => {
    setShowCreate(false);
    setCoverFile(null);
    setCoverError("");
    setDetailsBusy(false);
  }, []);

  useEffect(() => {
    if (!showCreate) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    createDialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCreate();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [showCreate, closeCreate]);

  function editNewSite(changes: Partial<typeof newSite>) {
    // A late details response must not replace a field the user has already edited.
    placeSelectionRef.current += 1;
    if (changes.name !== undefined) {
      setPlacePhotos([]);
      setPlaceDetails(null);
      setDetailsBusy(false);
      setSelectedPhotoName(null);
    }
    setNewSite((current) => ({ ...current, ...changes }));
  }

  useEffect(() => {
    setWorkspace(loadLocalWorkspace());
    setReady(true);
    const controller = new AbortController();
    fetch("/api/places/search", { signal: controller.signal })
      .then(async (response) => (response.ok ? responseBody(response) : null))
      .then((body) => {
        if (controller.signal.aborted || !body) return;
        setPlacesAvailability({
          configured: body["configured"] === true,
          availableWithoutAccount: body["availableWithoutAccount"] === true,
          photosEnabled: body["photosEnabled"] === true,
          reviewsEnabled: body["reviewsEnabled"] === true,
          contactFieldsEnabled: body["contactFieldsEnabled"] === true,
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const updateWorkspace = useCallback((next: AppWorkspace) => {
    setWorkspace(next);
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
      setMessage("O navegador ficou sem espaço. Exporte o site antes de sair desta página.");
    }
  }, []);

  function deleteSite(site: SiteRecord) {
    updateWorkspace({
      ...workspace,
      sites: workspace.sites.filter((entry) => entry.id !== site.id),
      contracts: workspace.contracts.map((contract) =>
        contract["siteId"] === site.id ? { ...contract, siteId: null } : contract,
      ),
    });
    setDeleteConfirmId(null);
    setMessage(`Projeto “${site.title}” excluído deste navegador.`);
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

  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (coverBusy) return;
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
      isDemo: false,
    });
    if (coverFile) {
      setCoverBusy(true);
      try {
        project.appearance.heroImage = await optimizeImage(coverFile, 1600);
        project.appearance.heroImageAlt = `Foto enviada para ${name}`;
      } catch (error) {
        setCoverError(error instanceof Error ? error.message : "Não foi possível usar esta foto.");
        setCoverBusy(false);
        return;
      }
      setCoverBusy(false);
    }
    project.slug = uniqueSlug(slugify(name), workspace.sites);
    const site: SiteRecord = {
      id: project.id,
      title: name,
      slug: project.slug,
      status: "draft",
      businessId: project.id,
      publicData: project,
    };
    setMessage("");
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
    placeSelectionRef.current += 1;
    const chosenPhoto = placePhotos.find((photo) => photo.name === selectedPhotoName);
    setPhotoReference(
      !coverFile && chosenPhoto ? { siteId: project.id, photo: chosenPhoto } : null,
    );
    setPlacePhotos([]);
    setPlaceDetails(null);
    setDetailsBusy(false);
    setSelectedPhotoName(null);
    setCoverFile(null);
    setCoverError("");
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

  const runPlacesSearch = useCallback(async (query: string, signal?: AbortSignal) => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const requestId = ++placeSearchRef.current;
    const cacheKey = normalized.toLocaleLowerCase("pt-BR");
    const cached = placeSearchCacheRef.current.get(cacheKey);
    if (cached) {
      setPlaceResults(cached);
      setPlacesMessage(
        cached.length
          ? ""
          : "Nenhuma empresa encontrada. Você pode preencher os dados manualmente.",
      );
      return;
    }
    setPlacesBusy(true);
    setPlacesMessage("");
    try {
      const response = await fetch("/api/places/search", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalized }),
        ...(signal ? { signal } : {}),
      });
      const body = await responseBody(response);
      if (placeSearchRef.current !== requestId) return;
      if (!response.ok)
        throw new Error(
          errorText(body, "Busca externa indisponível. Preencha os dados manualmente."),
        );
      const results = Array.isArray(body["results"])
        ? (body["results"] as PlaceSearchResult[])
        : [];
      if (placeSearchCacheRef.current.size >= 20) {
        const oldest = placeSearchCacheRef.current.keys().next().value;
        if (oldest) placeSearchCacheRef.current.delete(oldest);
      }
      placeSearchCacheRef.current.set(cacheKey, results);
      setPlaceResults(results);
      if (results.length === 0)
        setPlacesMessage("Nenhuma empresa encontrada. Você pode preencher os dados manualmente.");
    } catch (reason) {
      if (
        placeSearchRef.current !== requestId ||
        (reason instanceof Error && reason.name === "AbortError")
      )
        return;
      setPlacesMessage(
        reason instanceof Error ? reason.message : "Busca indisponível. Preencha manualmente.",
      );
    } finally {
      if (placeSearchRef.current === requestId) setPlacesBusy(false);
    }
  }, []);

  function searchPlaces(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (placeSearchTimerRef.current) clearTimeout(placeSearchTimerRef.current);
    placeSearchAbortRef.current?.abort();
    void runPlacesSearch(placeQuery);
  }

  function changePlaceQuery(value: string) {
    setPlaceQuery(value);
    setPlaceResults([]);
    setPlacesMessage("");
  }

  useEffect(() => {
    if (!ready || showCreate || placesAvailability?.availableWithoutAccount === false) return;
    if (placeQuery.trim().length < 4) {
      setPlaceResults([]);
      setPlacesMessage("");
      return;
    }
    const controller = new AbortController();
    placeSearchAbortRef.current = controller;
    placeSearchTimerRef.current = setTimeout(() => {
      void runPlacesSearch(placeQuery, controller.signal);
    }, 650);
    return () => {
      if (placeSearchTimerRef.current) clearTimeout(placeSearchTimerRef.current);
      controller.abort();
    };
  }, [ready, placeQuery, runPlacesSearch, showCreate, placesAvailability]);

  async function selectPlace(place: PlaceSearchResult) {
    const requestId = ++placeSelectionRef.current;
    placeSearchRef.current += 1;
    placeSearchAbortRef.current?.abort();
    setPlacesBusy(false);
    const template = placeTemplate(place.category);
    setPlacePhotos([]);
    setPlaceDetails(null);
    setDetailsBusy(true);
    setSelectedPhotoName(null);
    setNewSite((current) => ({
      ...current,
      name: place.name,
      category: template.category,
      archetype: template.archetype,
      address: place.address,
      phone: "",
      website: "",
      mapsUrl: "",
    }));
    setPlaceResults([]);
    setPlaceQuery("");
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
      setNewSite((current) => ({
        ...current,
        name: details.name,
        address: details.address,
        phone: details.phone,
        website: details.website,
        mapsUrl: details.mapsUrl,
      }));
      setPlacePhotos(details.photos);
      setPlaceDetails(details);
      setSelectedPhotoName(details.photos[0]?.name ?? null);
    } catch {
      if (placeSelectionRef.current === requestId)
        setPlacesMessage(
          "Os detalhes da empresa não foram carregados. Confira os campos manualmente.",
        );
    } finally {
      if (placeSelectionRef.current === requestId) setDetailsBusy(false);
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

  if (!ready)
    return (
      <main className="sx-app-loading">
        <LoaderCircle className="sx-spin" />
        <p>Abrindo seu espaço de trabalho…</p>
      </main>
    );

  return (
    <main className="sx-app">
      <div className={view === "studio" ? "sx-app-main sx-app-main--studio" : "sx-app-main"}>
        {view !== "studio" && (
          <header className="sx-app-header">
            <div>
              <a href="/" className="sx-app-brand" aria-label="Site Express — início">
                <Logo />
              </a>
            </div>
            <div className="sx-app-header__actions">
              <span className={`sx-app-save sx-app-save--${saveStatus}`} aria-live="polite">
                {saveStatus === "saved" ? <Check size={15} /> : <CircleAlert size={15} />}
                {saveStatus === "saved" ? "Salvo neste navegador" : "Falha ao salvar"}
              </span>
            </div>
          </header>
        )}
        {message && (
          <div className="sx-app-banner" role="status">
            <CircleAlert size={18} />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        )}
        {view === "studio" && activeSite?.publicData ? (
          <StudioPage
            key={activeSite.id}
            project={activeSite.publicData}
            onChange={editProject}
            onBack={() => setView("dashboard")}
            enableAiTools={false}
            enableImageTools
            photoReference={
              photoReference?.siteId === activeSite.id
                ? placePhotoUrl(photoReference.photo.name)
                : undefined
            }
            publicationStatus={activeSite.status}
            saveStatus={saveStatus}
          />
        ) : (
          <>
            <section className="sx-app-search-home">
              <h1>
                Digite a empresa.
                <br />
                Receba o <em>site pronto.</em>
              </h1>
              <p>
                Encontre os dados do negócio, confira as informações e crie uma página pronta para
                personalizar e exportar.
              </p>
              <form
                className="sx-app-search-home__form"
                onSubmit={(event) => void searchPlaces(event)}
              >
                <Search size={22} aria-hidden="true" />
                <input
                  aria-label="Nome da empresa e cidade"
                  value={placeQuery}
                  onChange={(event) => changePlaceQuery(event.target.value)}
                  placeholder="Nome da empresa e cidade"
                  minLength={2}
                  required
                  disabled={placesAvailability?.availableWithoutAccount === false}
                />
                <button
                  type="submit"
                  disabled={placesBusy || placesAvailability?.availableWithoutAccount === false}
                >
                  {placesBusy ? "Buscando…" : "Buscar empresa"} <ArrowRight size={17} />
                </button>
              </form>
              <button
                type="button"
                className="sx-app-search-home__manual"
                onClick={() => setShowCreate(true)}
              >
                Criar sem buscar <ArrowRight size={14} />
              </button>
              {placesAvailability?.availableWithoutAccount === false && (
                <p className="sx-app-search-home__message" role="status">
                  {placesAvailability.configured
                    ? "A busca do Google está desativada para uso sem conta nesta hospedagem. Você pode começar com os dados da empresa e importar as fotos autorizadas no editor."
                    : "A busca do Google ainda não foi configurada nesta hospedagem. Você pode começar com os dados da empresa e importar as fotos autorizadas no editor."}
                </p>
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
                      <small>{placeTemplate(place.category).category || "Empresa local"}</small>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className="sx-app-projects" id="sx-projects">
              <div className="sx-app-section-heading">
                <div>
                  <h2>
                    Meus sites <em>{workspace.sites.filter((site) => site.publicData).length}</em>
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
                    if (event.target === event.currentTarget) closeCreate();
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
                      onClick={closeCreate}
                    >
                      <X size={20} />
                    </button>
                    <div>
                      <span className="sx-app-kicker">NOVO PROJETO</span>
                      <h3>
                        {newSite.mapsUrl
                          ? "Confira a empresa encontrada."
                          : "Fale um pouco sobre o negócio."}
                      </h3>
                      <p>Confirme o essencial agora. Você pode completar o resto no editor.</p>
                    </div>
                    {detailsBusy && <p role="status">Carregando dados e fotos da empresa…</p>}
                    {placeDetails && (
                      <section
                        className="sx-app-place-summary"
                        aria-label="Informações encontradas no Google"
                      >
                        <div>
                          <strong>{placeDetails.name}</strong>
                          <span>{placeDetails.address}</span>
                          {placeDetails.phone && <span>{placeDetails.phone}</span>}
                          {placeDetails.website && (
                            <a href={placeDetails.website} target="_blank" rel="noreferrer">
                              Site da empresa
                            </a>
                          )}
                        </div>
                        {placeDetails.rating !== null && (
                          <p className="sx-app-place-summary__rating">
                            <strong>
                              {placeDetails.rating.toLocaleString("pt-BR", {
                                maximumFractionDigits: 1,
                              })}{" "}
                              ★
                            </strong>
                            {placeDetails.userRatingCount !== null && (
                              <span>
                                {placeDetails.userRatingCount.toLocaleString("pt-BR")} avaliações no
                                Google
                              </span>
                            )}
                          </p>
                        )}
                        {placeDetails.reviews.length > 0 && (
                          <details className="sx-app-place-reviews">
                            <summary>
                              Ver avaliações retornadas pelo Google ({placeDetails.reviews.length})
                            </summary>
                            <div>
                              {placeDetails.reviews.map((review, index) => (
                                <blockquote key={`${review.author.displayName}-${index}`}>
                                  <p>“{review.text}”</p>
                                  <footer>
                                    <span>{review.rating} ★</span>
                                    {review.author.uri ? (
                                      <a href={review.author.uri} target="_blank" rel="noreferrer">
                                        {review.author.displayName}
                                      </a>
                                    ) : (
                                      review.author.displayName
                                    )}
                                    {review.relativeTime && <span>{review.relativeTime}</span>}
                                  </footer>
                                </blockquote>
                              ))}
                            </div>
                          </details>
                        )}
                        <small>
                          Avaliações são referências do Google e não entram automaticamente no site
                          gerado.
                        </small>
                        {!placesAvailability?.reviewsEnabled && (
                          <small>
                            A importação de avaliações ainda não foi ativada nesta hospedagem.
                          </small>
                        )}
                        {placesAvailability?.reviewsEnabled &&
                          placeDetails.reviews.length === 0 && (
                            <small>O Google não retornou avaliações nesta consulta.</small>
                          )}
                        {!placesAvailability?.contactFieldsEnabled && (
                          <small>
                            Telefone e site comercial exigem ativação separada nesta hospedagem.
                          </small>
                        )}
                      </section>
                    )}
                    {placePhotos.length > 0 && (
                      <section
                        className="sx-app-place-photos"
                        aria-label="Fotos da empresa no Google"
                      >
                        <div className="sx-app-place-photos__heading">
                          <strong>Fotos encontradas no Google</strong>
                          <span>
                            {placePhotos.length} foto(s) retornada(s) · até 10 disponíveis nesta
                            consulta
                          </span>
                        </div>
                        {selectedPhotoName && (
                          <figure className="sx-app-place-photos__selected">
                            <img
                              src={placePhotoUrl(selectedPhotoName, 1200)}
                              alt="Foto selecionada da empresa no Google"
                            />
                            <figcaption>Referência selecionada para a capa</figcaption>
                          </figure>
                        )}
                        <div className="sx-app-place-photos__grid">
                          {placePhotos.map((photo, index) => (
                            <div key={photo.name} className="sx-app-place-photos__item">
                              <button
                                type="button"
                                className="sx-app-place-photos__photo"
                                aria-label={`Selecionar foto ${index + 1} como referência`}
                                aria-pressed={selectedPhotoName === photo.name}
                                onClick={() => setSelectedPhotoName(photo.name)}
                              >
                                <img
                                  src={placePhotoUrl(photo.name)}
                                  alt={`Foto ${index + 1} da empresa`}
                                  loading="lazy"
                                />
                                {selectedPhotoName === photo.name && (
                                  <Check size={18} aria-hidden="true" />
                                )}
                              </button>
                              {photo.attributions.map((author) =>
                                author.uri ? (
                                  <a
                                    key={author.displayName}
                                    href={author.uri}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {author.displayName}
                                  </a>
                                ) : (
                                  <span key={author.displayName}>{author.displayName}</span>
                                ),
                              )}
                            </div>
                          ))}
                        </div>
                        {newSite.mapsUrl && (
                          <a href={newSite.mapsUrl} target="_blank" rel="noreferrer">
                            Ver empresa no Google Maps
                          </a>
                        )}
                        <small>
                          As fotos do Google servem como referência. Para publicar ou exportar a
                          capa, envie uma imagem que você pode usar na aba Marca do editor.
                        </small>
                      </section>
                    )}
                    {placeDetails && placePhotos.length === 0 && (
                      <p className="sx-app-place-photos__empty">
                        {placesAvailability?.photosEnabled
                          ? "O Google não retornou fotos nesta consulta. Você pode enviar uma foto autorizada abaixo."
                          : "A importação de fotos ainda não foi ativada nesta hospedagem. Você pode enviar uma foto autorizada abaixo."}
                      </p>
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
                      <details className="sx-app-create__advanced">
                        <summary>Telefone, site e mapa (opcionais)</summary>
                        <label>
                          Telefone comercial
                          <input
                            type="tel"
                            value={newSite.phone}
                            onChange={(event) => editNewSite({ phone: event.target.value })}
                            placeholder="Não será tratado como WhatsApp"
                          />
                        </label>
                        <label>
                          Site atual da empresa
                          <input
                            type="url"
                            value={newSite.website}
                            onChange={(event) => editNewSite({ website: event.target.value })}
                            placeholder="https://exemplo.com.br"
                          />
                        </label>
                        <label>
                          Link do mapa
                          <input
                            type="url"
                            value={newSite.mapsUrl}
                            onChange={(event) => editNewSite({ mapsUrl: event.target.value })}
                            placeholder="https://www.google.com/maps/..."
                          />
                        </label>
                      </details>
                      <label className="sx-app-create__photo-upload">
                        Foto própria ou autorizada para a capa (opcional)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0] ?? null;
                            setCoverError("");
                            if (
                              file &&
                              (!/^image\/(jpeg|png|webp)$/.test(file.type) ||
                                file.size > 10 * 1024 * 1024)
                            ) {
                              setCoverFile(null);
                              setCoverError("Envie uma foto JPG, PNG ou WebP de até 10 MB.");
                              return;
                            }
                            setCoverFile(file);
                          }}
                        />
                      </label>
                      {coverError && (
                        <p className="sx-app-create__error" role="alert">
                          {coverError}
                        </p>
                      )}
                      <div className="sx-app-create__actions">
                        <button
                          type="button"
                          className="sx-app-secondary"
                          onClick={() => {
                            placeSelectionRef.current += 1;
                            closeCreate();
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="sx-app-primary"
                          disabled={coverBusy || Boolean(coverError)}
                        >
                          {coverBusy ? "Preparando foto…" : "Criar site"} <ArrowRight size={17} />
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
                        {deleteConfirmId === site.id && (
                          <div className="sx-app-site-card__confirm">
                            <p>Excluir este projeto deste navegador?</p>
                            <button type="button" onClick={() => setDeleteConfirmId(null)}>
                              Cancelar
                            </button>
                            <button type="button" onClick={() => deleteSite(site)}>
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
