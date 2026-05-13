import { NextResponse } from "next/server";
import {
  getChainContractAddress,
  getContractLabel,
  getDefaultApiBaseUrl,
  isSupportedChainId,
  MODAL_TOOLS,
  SELECTABLE_CONTRACT_KEYS,
  SUPPORTED_CHAINS,
  type ChainId,
  type IntegrationStatus,
} from "../../../../integration/integration";

function resolveHealthCheckTimeoutMs(): number {
  const configured = Number(process.env["SW3_HEALTH_CHECK_TIMEOUT_MS"] ?? "4000");
  if (!Number.isFinite(configured) || configured <= 0) {
    return 4_000;
  }
  return Math.round(configured);
}

const HEALTH_CHECK_TIMEOUT_MS = resolveHealthCheckTimeoutMs();

async function checkService(path: string, apiBaseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return {
      path,
      ok: response.ok,
      detail: response.ok ? "reachable" : `http_${response.status}`,
    };
  } catch {
    return {
      path,
      ok: false,
      detail: "unreachable",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkFirstReachablePath(paths: [string, ...string[]], apiBaseUrl: string) {
  for (const path of paths) {
    const status = await checkService(path, apiBaseUrl);
    if (status.ok) {
      return status;
    }
  }
  return checkService(paths[0], apiBaseUrl);
}

async function getIntegrationStatus(apiBaseUrl: string): Promise<IntegrationStatus> {
  const checks = await Promise.all([
    checkService("/health", apiBaseUrl).then((status) => ({ ...status, service: "api-gateway" })),
    checkFirstReachablePath(["/v1/sweeps", "/v1/sweeps/sweeps"], apiBaseUrl).then((status) => ({
      ...status,
      service: "sweeps",
    })),
    checkFirstReachablePath(["/v1/tokens", "/v1/tokens/tokens"], apiBaseUrl).then((status) => ({
      ...status,
      service: "tokens",
    })),
  ]);

  return {
    overall: checks.every((check) => check.ok) ? "healthy" : "degraded",
    checks,
  };
}

function parseDefaultChainId(): ChainId {
  const parsed = Number(process.env["NEXT_PUBLIC_CHAIN_ID"] ?? 1);
  return isSupportedChainId(parsed) ? parsed : 1;
}

export async function GET() {
  const apiBaseUrl = getDefaultApiBaseUrl();
  const status = await getIntegrationStatus(apiBaseUrl);
  const defaultChainId = parseDefaultChainId();

  return NextResponse.json({
    modalTools: MODAL_TOOLS,
    chains: SUPPORTED_CHAINS.map((chain) => ({
      id: chain.id,
      name: chain.name,
      isTestnet: chain.isTestnet,
      contracts: SELECTABLE_CONTRACT_KEYS.map((key) => {
        const address = getChainContractAddress(chain.id, key);
        return {
          key,
          label: getContractLabel(key),
          address,
          deployed: Boolean(address),
        };
      }),
    })),
    defaults: {
      modalTool: MODAL_TOOLS[0].id,
      chainId: defaultChainId,
      contractKey: "sweeper",
      apiBaseUrl,
    },
    integrationStatus: status,
  });
}
