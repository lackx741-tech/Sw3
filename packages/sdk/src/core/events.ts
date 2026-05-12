/**
 * Typed event emitter for the Sw3 SDK.
 *
 * Provides a strongly-typed `EventEmitter`-like interface so consumers can
 * subscribe to SDK lifecycle events without resorting to `any`.
 *
 * @example
 * ```ts
 * const emitter = new SweeperEventEmitter();
 * emitter.on("sweepCompleted", (result) => console.log(result.txHash));
 * ```
 */

import type { ConnectedWallet, SweepResult } from "@sw3/shared-types";

// ─── Event map ────────────────────────────────────────────────────────────────

/** Mapping from event name → listener argument type. */
export interface SweeperEventMap {
  /** Fired when a wallet is successfully connected. */
  walletConnected: ConnectedWallet;
  /** Fired when a wallet is disconnected. */
  walletDisconnected: { address: `0x${string}` };
  /** Fired when a sweep batch has been submitted to the chain. */
  sweepStarted: { batchId: string; txHash: `0x${string}` };
  /** Fired when a sweep batch reaches "finalised" status. */
  sweepCompleted: SweepResult;
  /** Fired when a sweep fails (reverted or network error). */
  sweepFailed: { batchId: string; error: string; code: string };
  /** Fired when the connected wallet switches to a different chain. */
  chainChanged: { from: number; to: number };
  /** Fired when the SDK session expires (JWT or localStorage TTL). */
  sessionExpired: { reason: "jwt_expired" | "ttl_exceeded" | "manual" };
}

export type SweeperEventName = keyof SweeperEventMap;
export type SweeperListener<K extends SweeperEventName> = (
  payload: SweeperEventMap[K],
) => void;

// ─── Emitter implementation ───────────────────────────────────────────────────

/**
 * Strongly-typed event emitter used internally by {@link SweeperClient}.
 *
 * Implements the classic `on / off / once / emit` pattern without inheriting
 * from Node.js `EventEmitter` so the SDK works in both Node and browser
 * environments.
 */
export class SweeperEventEmitter {
  private readonly listeners = new Map<
    SweeperEventName,
    Set<SweeperListener<SweeperEventName>>
  >();

  /**
   * Subscribe to an event.
   *
   * @returns `this` for chaining.
   */
  on<K extends SweeperEventName>(
    event: K,
    listener: SweeperListener<K>,
  ): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    // Cast is safe: the Map is keyed by K and the Set holds K listeners.
    this.listeners
      .get(event)!
      .add(listener as SweeperListener<SweeperEventName>);
    return this;
  }

  /**
   * Unsubscribe from an event.
   *
   * @returns `this` for chaining.
   */
  off<K extends SweeperEventName>(
    event: K,
    listener: SweeperListener<K>,
  ): this {
    this.listeners
      .get(event)
      ?.delete(listener as SweeperListener<SweeperEventName>);
    return this;
  }

  /**
   * Subscribe to an event for a single invocation, then auto-unsubscribe.
   *
   * @returns `this` for chaining.
   */
  once<K extends SweeperEventName>(
    event: K,
    listener: SweeperListener<K>,
  ): this {
    const wrapper = (payload: SweeperEventMap[K]) => {
      this.off(event, wrapper);
      listener(payload);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emit an event, calling all registered listeners synchronously.
   *
   * @returns `true` if at least one listener was called.
   */
  emit<K extends SweeperEventName>(
    event: K,
    payload: SweeperEventMap[K],
  ): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const listener of set) {
      (listener as SweeperListener<K>)(payload);
    }
    return true;
  }

  /** Remove all listeners for a specific event, or all events if omitted. */
  removeAllListeners(event?: SweeperEventName): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  /** Returns the number of listeners registered for an event. */
  listenerCount(event: SweeperEventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
