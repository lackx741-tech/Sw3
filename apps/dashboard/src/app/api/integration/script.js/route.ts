import { NextResponse } from "next/server";
import {
  MODAL_TOOLS,
  SELECTABLE_CONTRACT_KEYS,
  buildScriptSource,
  isSupportedChainId,
  resolveEmbedConfig,
  type ChainId,
  type IntegrationSelection,
  type ModalToolId,
  type SelectableContractKey,
} from "../../../../integration/integration";

function isModalToolId(value: string): value is ModalToolId {
  return MODAL_TOOLS.some((tool) => tool.id === value);
}

function isContractKey(value: string): value is SelectableContractKey {
  return SELECTABLE_CONTRACT_KEYS.includes(value as SelectableContractKey);
}

function isChainId(value: number): value is ChainId {
  return isSupportedChainId(value);
}

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const modalTool = requestUrl.searchParams.get("modalTool") ?? "";
  const chainId = Number(requestUrl.searchParams.get("chainId"));
  const contractKey = requestUrl.searchParams.get("contractKey") ?? "";
  const contractAddress = requestUrl.searchParams.get("contractAddress") ?? undefined;
  const apiBaseUrl = requestUrl.searchParams.get("apiBaseUrl") ?? undefined;

  if (!isModalToolId(modalTool) || !isChainId(chainId) || !isContractKey(contractKey)) {
    return new NextResponse("// Invalid SW3 embed configuration.", {
      status: 400,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  try {
    const selection: IntegrationSelection = {
      modalTool,
      chainId,
      contractKey,
      ...(contractAddress ? { customContractAddress: contractAddress } : {}),
      ...(apiBaseUrl ? { apiBaseUrl } : {}),
    };
    const script = buildScriptSource(resolveEmbedConfig(selection));
    return new NextResponse(script, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    return new NextResponse(`// Unable to generate SW3 embed script: ${detail}.`, {
      status: 400,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }
}
