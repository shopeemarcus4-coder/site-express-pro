import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  FileText,
  Globe2,
  Plus,
  Printer,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  CONTRACT_KINDS,
  EMPTY_CONTRACTS_STATE,
  createContract,
  daysBetween,
  dueNotifications,
  formatCalendarDate,
  formatCurrency,
  installmentAmounts,
  toBrazilCalendarDate,
  validateContract,
  type ClientRecord,
  type ContractKind,
  type ContractRecord,
  type ContractsState,
} from "./model";
import { loadContractsState, saveContractsState } from "./storage";
import "../../styles/contracts.css";

export interface ContractsPageProps {
  onBack?: () => void;
  value?: ContractsState;
  onChange?: (next: ContractsState) => void;
}

const kindOptions = Object.entries(CONTRACT_KINDS) as Array<
  [ContractKind, (typeof CONTRACT_KINDS)[ContractKind]]
>;

function safeWebsite(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function Field({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`sx-contracts__field ${className}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="sx-contracts__field-error">{error}</small> : null}
    </label>
  );
}

function ContractPrint({
  contract,
  client,
  site,
}: {
  contract: ContractRecord;
  client: ClientRecord;
  site?: { name: string; url: string } | undefined;
}) {
  const installments = installmentAmounts(contract.amountCents, contract.installments);
  return (
    <article className="sx-contracts__print" aria-label="Prévia para impressão">
      <div className="sx-contracts__print-overline">SITE EXPRESS · DOCUMENTO EM REVISÃO</div>
      <h1>{contract.title}</h1>
      <p className="sx-contracts__print-warning">
        Minuta de trabalho. Este documento não contém cláusulas jurídicas definitivas nem assinatura
        e precisa de revisão profissional antes do envio.
      </p>
      <dl>
        <div>
          <dt>Prestador</dt>
          <dd>{contract.providerName || "A preencher"}</dd>
        </div>
        <div>
          <dt>Cliente</dt>
          <dd>{contract.clientName || client.name}</dd>
        </div>
        <div>
          <dt>Categoria</dt>
          <dd>{CONTRACT_KINDS[contract.kind].title}</dd>
        </div>
        {site ? (
          <div>
            <dt>Site relacionado</dt>
            <dd>
              {site.name}
              {site.url ? ` · ${site.url}` : ""}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Escopo informado</dt>
          <dd className="sx-contracts__print-scope">{contract.scope || "A preencher"}</dd>
        </div>
        {contract.draftText?.trim() ? (
          <div>
            <dt>Texto da minuta</dt>
            <dd className="sx-contracts__print-scope">{contract.draftText}</dd>
          </div>
        ) : null}
        <div>
          <dt>Vigência</dt>
          <dd>
            {formatCalendarDate(contract.startsOn)} a {formatCalendarDate(contract.endsOn)}
          </dd>
        </div>
        <div>
          <dt>Valor acordado</dt>
          <dd>{formatCurrency(contract.amountCents)}</dd>
        </div>
        <div>
          <dt>Primeiro vencimento</dt>
          <dd>{formatCalendarDate(contract.firstPaymentOn)}</dd>
        </div>
        <div>
          <dt>Parcelamento</dt>
          <dd>
            {contract.installments} {contract.installments === 1 ? "parcela" : "parcelas"}{" "}
            {installments.length ? `· ${installments.map(formatCurrency).join(" + ")}` : ""}
          </dd>
        </div>
      </dl>
      <p className="sx-contracts__print-footer">
        Identificação jurídica, condições, foro e assinaturas pendentes de revisão e preenchimento
        em ambiente seguro.
      </p>
    </article>
  );
}

export function ContractsPage({ onBack, value, onChange }: ContractsPageProps) {
  const [localState, setLocalState] = useState<ContractsState>(EMPTY_CONTRACTS_STATE);
  const controlled = value !== undefined;
  const state = value ?? localState;
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientDraft, setClientDraft] = useState({ name: "", email: "", phone: "" });
  const [clientError, setClientError] = useState("");
  const [siteDraft, setSiteDraft] = useState({ name: "", url: "" });
  const [siteError, setSiteError] = useState("");
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [showContractPicker, setShowContractPicker] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (controlled) {
      setReady(true);
      return;
    }
    const restored = loadContractsState();
    setLocalState(restored);
    setClientId(restored.clients[0]?.id ?? null);
    setReady(true);
  }, [controlled]);

  useEffect(() => {
    if (!controlled && ready) setSaveFailed(!saveContractsState(state));
  }, [controlled, ready, state]);

  function updateState(updater: (previous: ContractsState) => ContractsState) {
    if (controlled) {
      onChange?.(updater(state));
    } else {
      setLocalState(updater);
    }
  }

  const activeClient =
    state.clients.find((client) => client.id === clientId) ?? state.clients[0] ?? null;
  const activeContracts = state.contracts.filter(
    (contract) => contract.clientId === activeClient?.id,
  );
  const activeContract =
    state.contracts.find((contract) => contract.id === contractId) ?? activeContracts[0] ?? null;
  const activeSite = activeClient?.sites.find((site) => site.id === activeContract?.siteId);
  const errors = activeContract ? validateContract(activeContract) : {};
  const valid = Object.keys(errors).length === 0;
  const today = toBrazilCalendarDate(new Date());
  const alerts = useMemo(() => dueNotifications(state.contracts, today), [state.contracts, today]);
  const visibleClients = state.clients.filter((client) => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (
      !term ||
      client.name.toLocaleLowerCase("pt-BR").includes(term) ||
      client.email.toLocaleLowerCase("pt-BR").includes(term)
    );
  });

  function addClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = clientDraft.name.trim();
    const email = clientDraft.email.trim();
    if (!name) {
      setClientError("Informe o nome do cliente.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClientError("Confira o e-mail informado.");
      return;
    }
    const client: ClientRecord = {
      id: crypto.randomUUID(),
      name,
      email,
      phone: clientDraft.phone.trim(),
      sites: [],
    };
    updateState((previous) => ({ ...previous, clients: [...previous.clients, client] }));
    setClientId(client.id);
    setContractId(null);
    setClientDraft({ name: "", email: "", phone: "" });
    setClientError("");
    setShowClientForm(false);
    setMessage(
      controlled ? "Cliente adicionado ao workspace." : "Cliente adicionado neste navegador.",
    );
  }

  function addSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeClient) return;
    const name = siteDraft.name.trim();
    const url = siteDraft.url.trim();
    if (!name) {
      setSiteError("Informe o nome do site.");
      return;
    }
    if (url && !safeWebsite(url)) {
      setSiteError("Use um endereço http ou https válido.");
      return;
    }
    updateState((previous) => ({
      ...previous,
      clients: previous.clients.map((client) =>
        client.id === activeClient.id
          ? { ...client, sites: [...client.sites, { id: crypto.randomUUID(), name, url }] }
          : client,
      ),
    }));
    setSiteDraft({ name: "", url: "" });
    setSiteError("");
    setShowSiteForm(false);
    setMessage("Site associado ao cliente.");
  }

  function addContract(kind: ContractKind) {
    if (!activeClient) return;
    const contract = createContract(activeClient, kind);
    updateState((previous) => ({ ...previous, contracts: [...previous.contracts, contract] }));
    setContractId(contract.id);
    setShowContractPicker(false);
    setShowErrors(false);
    setMessage("Minuta criada. Complete os campos para revisar.");
  }

  function editContract(changes: Partial<ContractRecord>) {
    if (!activeContract) return;
    const updatedAt = new Date().toISOString();
    updateState((previous) => ({
      ...previous,
      contracts: previous.contracts.map((contract) =>
        contract.id === activeContract.id
          ? {
              ...contract,
              ...changes,
              status: changes.status ?? "draft",
              updatedAt,
            }
          : contract,
      ),
    }));
    setMessage("");
  }

  function markForReview() {
    setShowErrors(true);
    if (!valid) {
      setMessage("Revise os campos destacados antes de marcar a minuta para revisão.");
      return;
    }
    editContract({ status: "review" });
    setMessage("Minuta marcada para revisão jurídica. Nenhuma assinatura foi enviada.");
  }

  function printDraft() {
    setShowErrors(true);
    if (!valid) {
      setMessage("Complete os campos obrigatórios antes de gerar a prévia.");
      return;
    }
    window.print();
  }

  return (
    <main className="sx-contracts">
      <div className="sx-contracts__screen">
        <header className="sx-contracts__top">
          <div className="sx-contracts__top-start">
            {onBack ? (
              <button
                type="button"
                className="sx-contracts__back"
                onClick={onBack}
                aria-label="Voltar"
              >
                <ArrowLeft size={19} />
              </button>
            ) : null}
            <div>
              <h1>Clientes e contratos</h1>
              <p>Organize relações comerciais e prepare minutas com clareza.</p>
            </div>
          </div>
          <span className="sx-contracts__local-note">
            <ShieldAlert size={16} />{" "}
            {controlled
              ? "Dados do workspace · minutas sujeitas a revisão"
              : "Dados salvos apenas neste navegador"}
          </span>
        </header>

        {!controlled && saveFailed ? (
          <p className="sx-contracts__notice sx-contracts__notice--error" role="alert">
            Não foi possível salvar neste navegador. Libere espaço antes de fechar a página.
          </p>
        ) : null}
        {alerts.length ? (
          <div className="sx-contracts__notice" role="status">
            <Bell size={17} aria-hidden="true" />
            <div>
              <strong>
                {alerts.length === 1
                  ? "Uma minuta exige atenção hoje"
                  : `${alerts.length} minutas exigem atenção hoje`}
              </strong>
              <span> · Confira as datas antes de qualquer contato.</span>
              <div>
                {alerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    className="sx-contracts__text-button"
                    onClick={() => {
                      setClientId(alert.clientId);
                      setContractId(alert.contractId);
                    }}
                  >
                    {alert.title} · {alert.daysBefore} dias até o fim da vigência em{" "}
                    {formatCalendarDate(alert.endsOn)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {message ? (
          <p className="sx-contracts__feedback" role="status">
            {message}
          </p>
        ) : null}

        <div className="sx-contracts__layout">
          <aside className="sx-contracts__clients" aria-label="Lista de clientes">
            <div className="sx-contracts__pane-head">
              <h2>
                Clientes <span>{state.clients.length}</span>
              </h2>
              <button
                className="sx-contracts__icon-button"
                type="button"
                onClick={() => setShowClientForm(!showClientForm)}
                aria-label="Adicionar cliente"
                aria-expanded={showClientForm}
              >
                <Plus size={18} />
              </button>
            </div>
            <label className="sx-contracts__search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Buscar clientes</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar clientes"
                type="search"
              />
            </label>
            {showClientForm ? (
              <form className="sx-contracts__inline-form" onSubmit={addClient}>
                <Field label="Nome">
                  <input
                    autoFocus
                    value={clientDraft.name}
                    onChange={(event) =>
                      setClientDraft({ ...clientDraft, name: event.target.value })
                    }
                    maxLength={120}
                  />
                </Field>
                <Field label="E-mail (opcional)">
                  <input
                    type="email"
                    value={clientDraft.email}
                    onChange={(event) =>
                      setClientDraft({ ...clientDraft, email: event.target.value })
                    }
                    maxLength={160}
                  />
                </Field>
                <Field label="Telefone (opcional)">
                  <input
                    type="tel"
                    value={clientDraft.phone}
                    onChange={(event) =>
                      setClientDraft({ ...clientDraft, phone: event.target.value })
                    }
                    maxLength={35}
                  />
                </Field>
                {clientError ? (
                  <p className="sx-contracts__field-error" role="alert">
                    {clientError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="sx-contracts__button sx-contracts__button--primary"
                >
                  Adicionar cliente
                </button>
              </form>
            ) : null}
            <div className="sx-contracts__client-list">
              {!state.clients.length && !showClientForm ? (
                <div className="sx-contracts__empty-small">
                  <p>Nenhum cliente cadastrado.</p>
                  <button type="button" onClick={() => setShowClientForm(true)}>
                    Adicionar o primeiro cliente <ChevronRight size={15} />
                  </button>
                </div>
              ) : null}
              {state.clients.length > 0 && !visibleClients.length ? (
                <p className="sx-contracts__empty-small">Nenhum cliente encontrado.</p>
              ) : null}
              {visibleClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className={`sx-contracts__client-item ${activeClient?.id === client.id ? "is-active" : ""}`}
                  onClick={() => {
                    setClientId(client.id);
                    setContractId(null);
                    setShowContractPicker(false);
                    setShowSiteForm(false);
                    setMessage("");
                  }}
                >
                  <span className="sx-contracts__avatar">
                    {client.name.slice(0, 1).toLocaleUpperCase("pt-BR")}
                  </span>
                  <span>
                    <strong>{client.name}</strong>
                    <small>
                      {client.sites.length} {client.sites.length === 1 ? "site" : "sites"} ·{" "}
                      {state.contracts.filter((item) => item.clientId === client.id).length}{" "}
                      {state.contracts.filter((item) => item.clientId === client.id).length === 1
                        ? "minuta"
                        : "minutas"}
                    </small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          </aside>

          <section className="sx-contracts__workspace" aria-label="Detalhes do cliente">
            {!activeClient ? (
              <div className="sx-contracts__welcome">
                <div className="sx-contracts__welcome-icon">
                  <FileText size={30} />
                </div>
                <h2>Seu espaço para organizar acordos</h2>
                <p>
                  Cadastre um cliente para reunir seus sites e preparar minutas de contrato. Você
                  poderá revisar cada detalhe antes de imprimir.
                </p>
                <button
                  type="button"
                  className="sx-contracts__button sx-contracts__button--primary"
                  onClick={() => setShowClientForm(true)}
                >
                  <Plus size={17} /> Adicionar cliente
                </button>
              </div>
            ) : (
              <>
                <div className="sx-contracts__client-header">
                  <div>
                    <h2>{activeClient.name}</h2>
                    <p>
                      {[activeClient.email, activeClient.phone].filter(Boolean).join(" · ") ||
                        "Contato ainda não informado"}
                    </p>
                  </div>
                  <span>
                    {activeContracts.length} {activeContracts.length === 1 ? "minuta" : "minutas"}
                  </span>
                </div>
                <section className="sx-contracts__sites" aria-label="Sites do cliente">
                  <div className="sx-contracts__section-head">
                    <div>
                      <Globe2 size={18} />
                      <h3>Sites associados</h3>
                    </div>
                    <button
                      type="button"
                      className="sx-contracts__text-button"
                      onClick={() => setShowSiteForm(!showSiteForm)}
                      aria-expanded={showSiteForm}
                    >
                      <Plus size={16} /> Adicionar site
                    </button>
                  </div>
                  {showSiteForm ? (
                    <form className="sx-contracts__site-form" onSubmit={addSite}>
                      <Field label="Nome do projeto">
                        <input
                          value={siteDraft.name}
                          onChange={(event) =>
                            setSiteDraft({ ...siteDraft, name: event.target.value })
                          }
                          maxLength={120}
                          placeholder="Ex.: Site da clínica"
                        />
                      </Field>
                      <Field label="Endereço (opcional)">
                        <input
                          type="url"
                          value={siteDraft.url}
                          onChange={(event) =>
                            setSiteDraft({ ...siteDraft, url: event.target.value })
                          }
                          maxLength={500}
                          placeholder="https://"
                        />
                      </Field>
                      <button
                        type="submit"
                        className="sx-contracts__button sx-contracts__button--secondary"
                      >
                        Salvar site
                      </button>
                      {siteError ? (
                        <p className="sx-contracts__field-error" role="alert">
                          {siteError}
                        </p>
                      ) : null}
                    </form>
                  ) : null}
                  {activeClient.sites.length ? (
                    <div className="sx-contracts__site-list">
                      {activeClient.sites.map((site) => (
                        <div key={site.id} className="sx-contracts__site">
                          <span className="sx-contracts__site-icon">
                            <Globe2 size={16} />
                          </span>
                          <span>
                            <strong>{site.name}</strong>
                            <small>{site.url || "Endereço ainda não informado"}</small>
                          </span>
                          {safeWebsite(site.url) ? (
                            <a
                              href={safeWebsite(site.url) ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir ${site.name}`}
                            >
                              Abrir
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="sx-contracts__hint">
                      Associe os sites deste cliente para encontrá-los junto às minutas.
                    </p>
                  )}
                </section>

                <section className="sx-contracts__documents" aria-label="Minutas de contrato">
                  <div className="sx-contracts__section-head">
                    <div>
                      <FileText size={18} />
                      <h3>Minutas de contrato</h3>
                    </div>
                    <button
                      type="button"
                      className="sx-contracts__text-button"
                      onClick={() => setShowContractPicker(!showContractPicker)}
                      aria-expanded={showContractPicker}
                    >
                      <Plus size={16} /> Nova minuta
                    </button>
                  </div>
                  {showContractPicker ? (
                    <div className="sx-contracts__kind-picker">
                      <p>
                        Escolha um ponto de partida. As cláusulas jurídicas serão definidas na
                        revisão.
                      </p>
                      <div>
                        {kindOptions.map(([kind, item]) => (
                          <button key={kind} type="button" onClick={() => addContract(kind)}>
                            <strong>{item.title}</strong>
                            <small>{item.description}</small>
                            <ChevronRight size={17} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {activeContracts.length ? (
                    <div className="sx-contracts__document-list">
                      {activeContracts.map((contract) => {
                        const remaining = daysBetween(today, contract.endsOn);
                        return (
                          <button
                            type="button"
                            key={contract.id}
                            className={`sx-contracts__document ${activeContract?.id === contract.id ? "is-active" : ""}`}
                            onClick={() => {
                              setContractId(contract.id);
                              setShowErrors(false);
                              setMessage("");
                            }}
                          >
                            <FileText size={18} />
                            <span>
                              <strong>{contract.title}</strong>
                              <small>
                                {contract.status === "review" ? "Em revisão jurídica" : "Rascunho"}
                                {remaining !== null
                                  ? ` · ${remaining < 0 ? `Venceu há ${-remaining} dias` : `Vence em ${remaining} dias`}`
                                  : ""}
                              </small>
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="sx-contracts__hint">
                      Prepare uma minuta para registrar as informações acordadas. Nenhum envio ou
                      assinatura é feito aqui.
                    </p>
                  )}
                </section>

                {activeContract ? (
                  <section className="sx-contracts__editor" aria-label="Editor de minuta">
                    <div className="sx-contracts__editor-head">
                      <div>
                        <h3>Editar minuta</h3>
                        <p>Preencha os dados confirmados com o cliente.</p>
                      </div>
                      <span
                        className={`sx-contracts__status ${activeContract.status === "review" ? "is-review" : ""}`}
                      >
                        {activeContract.status === "review" ? "Em revisão" : "Rascunho"}
                      </span>
                    </div>
                    <p className="sx-contracts__legal-note">
                      <ShieldAlert size={17} /> Modelo de coleta de dados. Texto jurídico
                      definitivo, identificação das partes e assinatura dependem de revisão
                      profissional.
                    </p>
                    <div className="sx-contracts__form-grid">
                      <Field
                        label="Título"
                        error={showErrors ? errors["title"] : undefined}
                        className="sx-contracts__field--full"
                      >
                        <input
                          value={activeContract.title}
                          onChange={(event) => editContract({ title: event.target.value })}
                          maxLength={160}
                          aria-invalid={showErrors && Boolean(errors["title"])}
                        />
                      </Field>
                      <Field label="Tipo de minuta">
                        <select
                          value={activeContract.kind}
                          onChange={(event) =>
                            editContract({ kind: event.target.value as ContractKind })
                          }
                        >
                          {kindOptions.map(([kind, item]) => (
                            <option value={kind} key={kind}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Site associado">
                        <select
                          value={activeContract.siteId ?? ""}
                          onChange={(event) => editContract({ siteId: event.target.value || null })}
                        >
                          <option value="">Nenhum site específico</option>
                          {activeClient.sites.map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="Prestador"
                        error={showErrors ? errors["providerName"] : undefined}
                      >
                        <input
                          value={activeContract.providerName}
                          onChange={(event) => editContract({ providerName: event.target.value })}
                          maxLength={160}
                          placeholder="Nome da sua empresa ou agência"
                          aria-invalid={showErrors && Boolean(errors["providerName"])}
                        />
                      </Field>
                      <Field label="Cliente" error={showErrors ? errors["clientName"] : undefined}>
                        <input
                          value={activeContract.clientName}
                          onChange={(event) => editContract({ clientName: event.target.value })}
                          maxLength={160}
                          aria-invalid={showErrors && Boolean(errors["clientName"])}
                        />
                      </Field>
                      <Field
                        label="Escopo combinado"
                        error={showErrors ? errors["scope"] : undefined}
                        className="sx-contracts__field--full"
                      >
                        <textarea
                          value={activeContract.scope}
                          onChange={(event) => editContract({ scope: event.target.value })}
                          rows={4}
                          maxLength={4000}
                          placeholder="Descreva apenas os serviços e condições realmente acordados."
                          aria-invalid={showErrors && Boolean(errors["scope"])}
                        />
                      </Field>
                      <Field
                        label="Texto da minuta (opcional)"
                        className="sx-contracts__field--full"
                      >
                        <textarea
                          value={activeContract.draftText ?? ""}
                          onChange={(event) => editContract({ draftText: event.target.value })}
                          rows={8}
                          maxLength={20000}
                          placeholder="Escreva aqui apenas o texto revisado ou fornecido por você. O app não acrescenta cláusulas jurídicas automaticamente."
                        />
                      </Field>
                      <Field
                        label="Valor total (R$)"
                        error={showErrors ? errors["amountCents"] : undefined}
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            activeContract.amountCents
                              ? (activeContract.amountCents / 100).toFixed(2)
                              : ""
                          }
                          onChange={(event) =>
                            editContract({
                              amountCents: Math.round(Number(event.target.value) * 100),
                            })
                          }
                          placeholder="0,00"
                          aria-invalid={showErrors && Boolean(errors["amountCents"])}
                        />
                      </Field>
                      <Field
                        label="Parcelas"
                        error={showErrors ? errors["installments"] : undefined}
                      >
                        <input
                          type="number"
                          min="1"
                          max="36"
                          step="1"
                          value={activeContract.installments}
                          onChange={(event) =>
                            editContract({ installments: Number(event.target.value) })
                          }
                          aria-invalid={showErrors && Boolean(errors["installments"])}
                        />
                      </Field>
                      <Field
                        label="Início da vigência"
                        error={showErrors ? errors["startsOn"] : undefined}
                      >
                        <input
                          type="date"
                          value={activeContract.startsOn}
                          onChange={(event) => editContract({ startsOn: event.target.value })}
                          aria-invalid={showErrors && Boolean(errors["startsOn"])}
                        />
                      </Field>
                      <Field
                        label="Fim da vigência"
                        error={showErrors ? errors["endsOn"] : undefined}
                      >
                        <input
                          type="date"
                          value={activeContract.endsOn}
                          onChange={(event) => editContract({ endsOn: event.target.value })}
                          aria-invalid={showErrors && Boolean(errors["endsOn"])}
                        />
                      </Field>
                      <Field
                        label="Primeiro vencimento"
                        error={showErrors ? errors["firstPaymentOn"] : undefined}
                      >
                        <input
                          type="date"
                          value={activeContract.firstPaymentOn}
                          onChange={(event) => editContract({ firstPaymentOn: event.target.value })}
                          aria-invalid={showErrors && Boolean(errors["firstPaymentOn"])}
                        />
                      </Field>
                    </div>
                    {activeContract.amountCents > 0 &&
                    activeContract.installments > 0 &&
                    activeContract.installments <= 36 ? (
                      <p className="sx-contracts__payment-note">
                        {formatCurrency(activeContract.amountCents)} em{" "}
                        {activeContract.installments}{" "}
                        {activeContract.installments === 1 ? "parcela" : "parcelas"}. A distribuição
                        dos centavos é feita automaticamente na prévia.
                      </p>
                    ) : null}
                    <div className="sx-contracts__actions">
                      <button
                        type="button"
                        className="sx-contracts__button sx-contracts__button--primary"
                        onClick={markForReview}
                      >
                        <Check size={17} /> Marcar para revisão
                      </button>
                      <button
                        type="button"
                        className="sx-contracts__button sx-contracts__button--secondary"
                        onClick={printDraft}
                      >
                        <Printer size={17} /> Imprimir minuta
                      </button>
                      {activeContract.status === "review" ? (
                        <button
                          type="button"
                          className="sx-contracts__text-button"
                          onClick={() => {
                            editContract({ status: "draft" });
                            setMessage("Minuta devolvida aos rascunhos.");
                          }}
                        >
                          Voltar a rascunho
                        </button>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
      {activeContract && activeClient ? (
        <ContractPrint contract={activeContract} client={activeClient} site={activeSite} />
      ) : null}
    </main>
  );
}
