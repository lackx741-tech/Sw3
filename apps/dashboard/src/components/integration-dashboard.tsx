"use client";

import * as React from "react";

type HealthOverall = "healthy" | "degraded";

interface IntegrationStatusCheck {
  service: string;
  path: string;
  ok: boolean;
  detail: string;
}

interface ChainContractOption {
  key: string;
  label: string;
  address: string | null;
  deployed: boolean;
}

interface ChainOption {
  id: number;
  name: string;
  isTestnet: boolean;
  contracts: ChainContractOption[];
}

interface ModalToolOption {
  id: string;
  name: string;
  description: string;
}

interface OptionsResponse {
  modalTools: ModalToolOption[];
  chains: ChainOption[];
  defaults: {
    modalTool: string;
    chainId: number;
    contractKey: string;
    apiBaseUrl: string;
  };
  integrationStatus: {
    overall: HealthOverall;
    checks: IntegrationStatusCheck[];
  };
}

interface CompileResponse {
  compiledAt: string;
  config: {
    modalTool: string;
    chainId: number;
    chainName: string;
    contractKey: string;
    contractLabel: string;
    contractAddress: string;
    apiBaseUrl: string;
  };
  scriptUrl: string;
  scriptSource: string;
  embedSnippet: string;
}

function StatusBadge({ healthy }: { healthy: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        healthy ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {healthy ? "Healthy" : "Degraded"}
    </span>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyToClipboard}
      className="rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50"
    >
      {copied ? `${label} copied` : `Copy ${label}`}
    </button>
  );
}

export function IntegrationDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [options, setOptions] = React.useState<OptionsResponse | null>(null);
  const [modalTool, setModalTool] = React.useState("");
  const [chainId, setChainId] = React.useState(1);
  const [contractKey, setContractKey] = React.useState("");
  const [customContractAddress, setCustomContractAddress] = React.useState("");
  const [apiBaseUrl, setApiBaseUrl] = React.useState("");
  const [compileError, setCompileError] = React.useState<string | null>(null);
  const [compiling, setCompiling] = React.useState(false);
  const [compiled, setCompiled] = React.useState<CompileResponse | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch("/api/integration/options", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(
            `Failed to load integration options (HTTP ${response.status} ${response.statusText}).`,
          );
        }
        const payload = (await response.json()) as OptionsResponse;
        setOptions(payload);
        setModalTool(payload.defaults.modalTool);
        setChainId(payload.defaults.chainId);
        setContractKey(payload.defaults.contractKey);
        setApiBaseUrl(payload.defaults.apiBaseUrl);
        setLoadError(null);
      } catch (error: unknown) {
        setLoadError(error instanceof Error ? error.message : "Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const selectedChain = React.useMemo(
    () => options?.chains.find((chain) => chain.id === chainId) ?? null,
    [options?.chains, chainId],
  );
  const selectedContract = React.useMemo(
    () => selectedChain?.contracts.find((contract) => contract.key === contractKey) ?? null,
    [selectedChain, contractKey],
  );

  async function generate() {
    setCompileError(null);
    setCompiling(true);
    try {
      const response = await fetch("/api/integration/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modalTool,
          chainId,
          contractKey,
          customContractAddress,
          apiBaseUrl,
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        const message =
          typeof failure === "object" &&
          failure !== null &&
          "error" in failure &&
          typeof failure.error === "string"
            ? failure.error
            : "Failed to compile integration.";
        throw new Error(message);
      }
      const payload = (await response.json()) as CompileResponse;
      setCompiled(payload);
    } catch (error: unknown) {
      setCompileError(error instanceof Error ? error.message : "Compilation failed.");
    } finally {
      setCompiling(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900 md:px-10">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight">SW3 Integration Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Configure modal/tool behavior, choose contract targets, validate backend connectivity,
            and generate production-ready embeddable Script.js output.
          </p>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            Loading dashboard configuration...
          </section>
        ) : null}

        {loadError ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
            {loadError}
          </section>
        ) : null}

        {options ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Integration Status</h2>
                <StatusBadge healthy={options.integrationStatus.overall === "healthy"} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {options.integrationStatus.checks.map((check) => (
                  <article key={check.service} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold uppercase text-slate-700">
                        {check.service}
                      </p>
                      <StatusBadge healthy={check.ok} />
                    </div>
                    <p className="text-xs text-slate-500">{check.path}</p>
                    <p className="mt-1 text-xs text-slate-700">{check.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">Modal / Tool Selection</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Choose the integration entrypoint used by your generated script.
                </p>
                <label
                  className="mt-4 block text-sm font-medium text-slate-700"
                  htmlFor="modal-tool"
                >
                  Modal / Tool
                </label>
                <select
                  id="modal-tool"
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={modalTool}
                  onChange={(event) => setModalTool(event.target.value)}
                >
                  {options.modalTools.map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                  {options.modalTools.find((tool) => tool.id === modalTool)?.description}
                </p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">Contract Selection</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Select chain and contract target for frontend/backend blockchain execution.
                </p>

                <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="chain">
                  Chain
                </label>
                <select
                  id="chain"
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={chainId}
                  onChange={(event) => {
                    const nextChainId = Number(event.target.value);
                    setChainId(nextChainId);
                    const nextChain = options.chains.find((chain) => chain.id === nextChainId);
                    setContractKey(nextChain?.contracts[0]?.key ?? "");
                  }}
                >
                  {options.chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name} {chain.isTestnet ? "(testnet)" : ""}
                    </option>
                  ))}
                </select>

                <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="contract">
                  Contract
                </label>
                <select
                  id="contract"
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={contractKey}
                  onChange={(event) => setContractKey(event.target.value)}
                >
                  {selectedChain?.contracts.map((contract) => (
                    <option key={contract.key} value={contract.key}>
                      {contract.label}
                    </option>
                  ))}
                </select>

                <p className="mt-3 text-xs text-slate-600">
                  Default address:{" "}
                  <span className="font-mono text-[11px]">
                    {selectedContract?.address ?? "Not deployed on this chain"}
                  </span>
                </p>

                <label
                  className="mt-4 block text-sm font-medium text-slate-700"
                  htmlFor="custom-contract"
                >
                  Custom contract override (optional, required if not deployed)
                </label>
                <input
                  id="custom-contract"
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                  value={customContractAddress}
                  onChange={(event) => setCustomContractAddress(event.target.value)}
                  placeholder="0x..."
                />
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Compile & Script Generation</h2>
              <p className="mt-1 text-sm text-slate-600">
                Compile integration config and generate embeddable Script.js + website snippet.
              </p>
              <label
                className="mt-4 block text-sm font-medium text-slate-700"
                htmlFor="api-base-url"
              >
                Backend API base URL
              </label>
              <input
                id="api-base-url"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrl(event.target.value)}
                placeholder="https://api.sw3.io"
              />

              {compileError ? (
                <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {compileError}
                </div>
              ) : null}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={compiling}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {compiling ? "Compiling..." : "Generate Script.js"}
                </button>
              </div>
            </section>

            {compiled ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Generated Output</h2>
                  <p className="text-xs text-slate-500">
                    Compiled at {new Date(compiled.compiledAt).toLocaleString()}
                  </p>
                </div>

                <div className="mb-4 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                  Active target: {compiled.config.contractLabel} · {compiled.config.contractAddress}{" "}
                  · {compiled.config.chainName}
                </div>

                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Script URL</p>
                    <CopyButton value={compiled.scriptUrl} label="Script URL" />
                  </div>
                  <textarea
                    className="h-20 w-full rounded-md border border-slate-300 bg-slate-50 p-3 text-xs"
                    readOnly
                    value={compiled.scriptUrl}
                  />
                </div>

                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Website Embed Snippet</p>
                    <CopyButton value={compiled.embedSnippet} label="snippet" />
                  </div>
                  <textarea
                    className="h-36 w-full rounded-md border border-slate-300 bg-slate-50 p-3 text-xs font-mono"
                    readOnly
                    value={compiled.embedSnippet}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Generated Script.js Source</p>
                    <CopyButton value={compiled.scriptSource} label="script" />
                  </div>
                  <textarea
                    className="h-64 w-full rounded-md border border-slate-300 bg-slate-50 p-3 text-xs font-mono"
                    readOnly
                    value={compiled.scriptSource}
                  />
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
