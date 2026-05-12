/**
 * Ambient type declarations for optional wallet provider packages.
 *
 * `@walletconnect/ethereum-provider` and `@coinbase/wallet-sdk` are NOT
 * listed as direct dependencies — they are loaded on-demand via dynamic
 * `import()` in `WalletConnector` to keep bundle sizes minimal.
 *
 * Consumers who need WalletConnect or Coinbase Wallet support must install
 * those packages themselves.  The declarations here provide just enough typing
 * for the internal connector logic to compile without errors.
 */

declare module "@walletconnect/ethereum-provider" {
  interface EthereumProviderOptions {
    projectId: string;
    chains: number[];
    showQrModal?: boolean;
    [key: string]: unknown;
  }

  interface WalletConnectProvider {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    on(event: string, listener: (...args: unknown[]) => void): void;
    removeListener(event: string, listener: (...args: unknown[]) => void): void;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
  }

  export const EthereumProvider: {
    init(opts: EthereumProviderOptions): Promise<WalletConnectProvider>;
  };
}

declare module "@coinbase/wallet-sdk" {
  interface CoinbaseWalletSDKOptions {
    appName: string;
    appLogoUrl?: string;
    [key: string]: unknown;
  }

  interface CoinbaseProvider {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    on(event: string, listener: (...args: unknown[]) => void): void;
    removeListener(event: string, listener: (...args: unknown[]) => void): void;
  }

  export class CoinbaseWalletSDK {
    constructor(opts: CoinbaseWalletSDKOptions);
    makeWeb3Provider(): CoinbaseProvider;
  }
}
