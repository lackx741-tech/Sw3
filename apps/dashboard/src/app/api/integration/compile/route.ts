import { NextResponse } from "next/server";
import {
  MODAL_TOOLS,
  SELECTABLE_CONTRACT_KEYS,
  buildEmbedSnippet,
  buildScriptSource,
  isSupportedChainId,
  resolveEmbedConfig,
  toScriptSearchParams,
  type ChainId,
  type IntegrationSelection,
  type ModalToolId,
  type SelectableContractKey,
} from "../../../../integration/integration";

interface CompileRequestBody {
  modalTool?: string;
  chainId?: number;
  contractKey?: string;
  customContractAddress?: string;
  apiBaseUrl?: string;
}

function isModalToolId(value: string): value is ModalToolId {
  return MODAL_TOOLS.some((tool) => tool.id === value);
}

function isContractKey(value: string): value is SelectableContractKey {
  return SELECTABLE_CONTRACT_KEYS.includes(value as SelectableContractKey);
}

function isChainId(value: number): value is ChainId {
  return isSupportedChainId(value);
}

export async function POST(request: Request) {
  let body: CompileRequestBody;
  try {
    body = (await request.json()) as CompileRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body.modalTool || !isModalToolId(body.modalTool)) {
    return NextResponse.json(
      { error: "Select a valid modal/tool before generating." },
      { status: 400 },
    );
  }

  if (typeof body.chainId !== "number" || !isChainId(body.chainId)) {
    return NextResponse.json({ error: "Select a valid chain." }, { status: 400 });
  }

  if (!body.contractKey || !isContractKey(body.contractKey)) {
    return NextResponse.json({ error: "Select a valid target contract." }, { status: 400 });
  }

  let embedConfig;
  try {
    const selection: IntegrationSelection = {
      modalTool: body.modalTool,
      chainId: body.chainId,
      contractKey: body.contractKey,
      ...(body.customContractAddress ? { customContractAddress: body.customContractAddress } : {}),
      ...(body.apiBaseUrl ? { apiBaseUrl: body.apiBaseUrl } : {}),
    };
    embedConfig = resolveEmbedConfig(selection);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid integration configuration." },
      { status: 400 },
    );
  }

  const requestUrl = new URL(request.url);
  const scriptParams = toScriptSearchParams(embedConfig);
  const scriptUrl = `${requestUrl.origin}/api/integration/script.js?${scriptParams.toString()}`;
  const scriptSource = buildScriptSource(embedConfig);
  const embedSnippet = buildEmbedSnippet(scriptUrl);

  return NextResponse.json({
    compiledAt: new Date().toISOString(),
    config: embedConfig,
    scriptUrl,
    scriptSource,
    embedSnippet,
  });
}
