"use client";

import { ReactNode, useMemo } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider as RKProvider,
  lightTheme
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mainnet, sepolia, arbitrumSepolia, mantleSepoliaTestnet } from 'wagmi/chains';
import { http } from 'viem';

// You should get a project ID from WalletConnect Cloud: https://cloud.walletconnect.com/
// For development, you can use a placeholder, but for production you'll need a real one
const projectId = 'YOUR_PROJECT_ID';

// Configure chains and generate required connectors
// Lazily initialize on the client to avoid touching browser APIs during SSR

interface RainbowKitProviderProps {
  children: ReactNode;
}

export const RainbowKitProvider: React.FC<RainbowKitProviderProps> = ({ children }) => {
  const config = useMemo(() => getDefaultConfig({
    appName: 'ZK Asset Raffle',
    projectId,
    chains: [mainnet, sepolia, mantleSepoliaTestnet, arbitrumSepolia],
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
      [mantleSepoliaTestnet.id]: http(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_TESTNET_RPC_URL),
      [arbitrumSepolia.id]: http(process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL),
    },
    ssr: true,
  }), []);
  return (
    <WagmiProvider config={config}>
      <RKProvider
        theme={lightTheme({
          accentColor: '#3b82f6', // blue-500
          accentColorForeground: 'white',
          borderRadius: 'medium',
        })}
        modalSize="compact"
        showRecentTransactions={false}
        coolMode
      >
        {children}
      </RKProvider>
    </WagmiProvider>
  );
};
