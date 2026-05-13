export const SUPPORTED_CHAINS = [
  { id: 1, name: "Ethereum Mainnet", isTestnet: false },
  { id: 5, name: "Goerli Testnet", isTestnet: true },
  { id: 11155111, name: "Sepolia Testnet", isTestnet: true },
  { id: 42161, name: "Arbitrum One", isTestnet: false },
  { id: 10, name: "OP Mainnet", isTestnet: false },
  { id: 137, name: "Polygon Mainnet", isTestnet: false },
  { id: 8453, name: "Base", isTestnet: false },
] as const;

export type ChainId = (typeof SUPPORTED_CHAINS)[number]["id"];

export const MODAL_TOOLS = [
  {
    id: "sweepModal",
    name: "Sweep Modal",
    description: "Guided modal flow for selecting tokens and confirming sweeps.",
  },
  {
    id: "walletButton",
    name: "Wallet Button",
    description: "Lightweight wallet-connect entrypoint for your integration flow.",
  },
  {
    id: "transactionStatus",
    name: "Transaction Status",
    description: "Embedded transaction progress and settlement status modal.",
  },
] as const;

export type ModalToolId = (typeof MODAL_TOOLS)[number]["id"];

export const SELECTABLE_CONTRACT_KEYS = [
  "sweeper",
  "permitRouter",
  "feeRouter",
  "delegatedExecutor",
] as const;

export type SelectableContractKey = (typeof SELECTABLE_CONTRACT_KEYS)[number];

const DEFAULT_API_BASE_URL = "https://api.sw3.io";

const CONTRACT_LABELS: Record<SelectableContractKey, string> = {
  sweeper: "Sweeper Contract",
  permitRouter: "Permit Router",
  feeRouter: "Fee Router",
  delegatedExecutor: "Delegated Executor",
};

type ContractAddressMap = Record<SelectableContractKey, `0x${string}` | null>;

// Keep these aligned with packages/config/src/contracts.ts.
// Some values may intentionally remain placeholder until production deployments are finalized.
const CONTRACT_ADDRESSES: Record<ChainId, ContractAddressMap> = {
  1: {
    sweeper: "0x1111111111111111111111111111111111111111",
    permitRouter: "0x3333333333333333333333333333333333333333",
    feeRouter: "0x2222222222222222222222222222222222222222",
    delegatedExecutor: null,
  },
  5: {
    sweeper: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    permitRouter: "0xcccccccccccccccccccccccccccccccccccccccc",
    feeRouter: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    delegatedExecutor: null,
  },
  11155111: {
    sweeper: "0xdddddddddddddddddddddddddddddddddddddddd",
    permitRouter: "0xffffffffffffffffffffffffffffffffffffffff",
    feeRouter: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    delegatedExecutor: null,
  },
  42161: {
    sweeper: "0x4444444444444444444444444444444444444444",
    permitRouter: "0x6666666666666666666666666666666666666666",
    feeRouter: "0x5555555555555555555555555555555555555555",
    delegatedExecutor: null,
  },
  10: {
    sweeper: "0x7777777777777777777777777777777777777777",
    permitRouter: "0x9999999999999999999999999999999999999999",
    feeRouter: "0x8888888888888888888888888888888888888888",
    delegatedExecutor: null,
  },
  137: {
    sweeper: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    permitRouter: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    feeRouter: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    delegatedExecutor: null,
  },
  8453: {
    sweeper: "0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    permitRouter: "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    feeRouter: "0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
    delegatedExecutor: null,
  },
};

export interface IntegrationSelection {
  modalTool: ModalToolId;
  chainId: ChainId;
  contractKey: SelectableContractKey;
  customContractAddress?: string;
  apiBaseUrl?: string;
}

export interface ServiceStatus {
  service: string;
  path: string;
  ok: boolean;
  detail: string;
}

export interface IntegrationStatus {
  overall: "healthy" | "degraded";
  checks: ServiceStatus[];
}

export interface EmbedConfig {
  modalTool: ModalToolId;
  chainId: ChainId;
  chainName: string;
  contractKey: SelectableContractKey;
  contractLabel: string;
  contractAddress: `0x${string}`;
  apiBaseUrl: string;
}

export function getDefaultApiBaseUrl(): string {
  return (process.env["NEXT_PUBLIC_API_URL"] ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export function isEvmAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function getContractLabel(contractKey: SelectableContractKey): string {
  return CONTRACT_LABELS[contractKey];
}

export function isSupportedChainId(value: number): value is ChainId {
  return SUPPORTED_CHAINS.some((chain) => chain.id === value);
}

export function getChainContractAddress(
  chainId: ChainId,
  contractKey: SelectableContractKey,
): ContractAddressMap[SelectableContractKey] {
  return CONTRACT_ADDRESSES[chainId][contractKey];
}

export function resolveEmbedConfig(selection: IntegrationSelection): EmbedConfig {
  const chain = SUPPORTED_CHAINS.find((entry) => entry.id === selection.chainId);
  if (!chain) {
    throw new Error(`Unsupported chain selected: ${selection.chainId}`);
  }

  const deployedAddress = getChainContractAddress(selection.chainId, selection.contractKey);
  const selectedAddress = selection.customContractAddress?.trim() || deployedAddress;

  if (!selectedAddress) {
    throw new Error(
      `Contract "${selection.contractKey}" is not deployed on ${chain.name}. Provide a custom contract address.`,
    );
  }

  if (!isEvmAddress(selectedAddress)) {
    throw new Error("Contract address must be a valid 0x-prefixed 40-byte hex EVM address.");
  }

  const apiBaseUrl = (selection.apiBaseUrl?.trim() || getDefaultApiBaseUrl()).replace(/\/$/, "");

  return {
    modalTool: selection.modalTool,
    chainId: selection.chainId,
    chainName: chain.name,
    contractKey: selection.contractKey,
    contractLabel: getContractLabel(selection.contractKey),
    contractAddress: selectedAddress,
    apiBaseUrl,
  };
}

export function toScriptSearchParams(config: EmbedConfig): URLSearchParams {
  const params = new URLSearchParams({
    modalTool: config.modalTool,
    chainId: String(config.chainId),
    contractKey: config.contractKey,
    contractAddress: config.contractAddress,
    apiBaseUrl: config.apiBaseUrl,
  });
  return params;
}

export function buildEmbedSnippet(scriptUrl: string): string {
  return `<script src="${scriptUrl}" defer></script>
<div id="sw3-embed-root" data-sw3-embed></div>
<script>
  window.addEventListener("DOMContentLoaded", function () {
    window.SW3Embed?.mount?.("#sw3-embed-root");
  });
</script>`;
}

export function buildScriptSource(config: EmbedConfig): string {
  const serialized = JSON.stringify(config, null, 2);

  return `(function () {
  const config = ${serialized};

  function mount(target) {
    const host =
      typeof target === "string"
        ? document.querySelector(target)
        : target || document.querySelector("[data-sw3-embed]");

    if (!host) return;

    host.innerHTML = "";
    host.style.fontFamily = "Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
    host.style.border = "1px solid #e2e8f0";
    host.style.borderRadius = "12px";
    host.style.padding = "16px";
    host.style.background = "#ffffff";
    host.style.color = "#0f172a";

    const title = document.createElement("h3");
    title.textContent = \`SW3 \${config.modalTool} integration\`;
    title.style.margin = "0 0 8px";
    title.style.fontSize = "16px";
    host.appendChild(title);

    const summary = document.createElement("p");
    summary.textContent = \`Contract: \${config.contractLabel} (\${config.contractAddress}) · Chain: \${config.chainName}\`;
    summary.style.margin = "0 0 12px";
    summary.style.fontSize = "13px";
    summary.style.color = "#475569";
    host.appendChild(summary);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Launch SW3 Flow";
    button.style.padding = "10px 14px";
    button.style.borderRadius = "10px";
    button.style.border = "1px solid #0f172a";
    button.style.background = "#0f172a";
    button.style.color = "#ffffff";
    button.style.cursor = "pointer";
    button.onclick = async function () {
      button.disabled = true;
      button.textContent = "Checking backend...";
      try {
        const health = await fetch(config.apiBaseUrl + "/health");
        if (!health.ok) throw new Error("Backend not healthy");
        button.textContent = \`Connected · \${config.modalTool}\`;
      } catch (error) {
        button.textContent = "Retry connection";
      } finally {
        button.disabled = false;
      }
    };
    host.appendChild(button);
  }

  window.SW3Embed = window.SW3Embed || {};
  window.SW3Embed.config = config;
  window.SW3Embed.mount = mount;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      mount();
    });
  } else {
    mount();
  }
})();`;
}
