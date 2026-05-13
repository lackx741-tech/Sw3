/**
 * @sw3/sdk
 *
 * Complete barrel export for the Sw3 TypeScript SDK.
 *
 * Import the full SDK:
 * ```ts
 * import { SweeperClient, WalletConnector, BatchBuilder } from "@sw3/sdk";
 * ```
 *
 * Or cherry-pick from sub-paths:
 * ```ts
 * import { SweeperClient } from "@sw3/sdk/core";
 * import { BatchBuilder } from "@sw3/sdk/execution";
 * ```
 */

// Core
export * from "./core/client.js";
export * from "./core/errors.js";
export * from "./core/events.js";

// Wallet
export * from "./wallet/connector.js";
export * from "./wallet/session.js";

// Auth
export * from "./auth/siwe.js";

// Execution
export * from "./execution/batchBuilder.js";
export * from "./execution/executor.js";
export * from "./execution/permit.js";

// Delegation (EIP-7702-style)
export * from "./delegation/authorizer.js";
export * from "./delegation/delegatedExecutor.js";

// RPC
export * from "./rpc/provider.js";
export * from "./rpc/retry.js";

// Analytics
export * from "./analytics/tracker.js";

// API client
export * from "./api/client.js";

// Utilities
export * from "./utils/format.js";
export * from "./utils/validation.js";
