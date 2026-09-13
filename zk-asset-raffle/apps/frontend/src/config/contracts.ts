// 合约配置文件
import ZkAssetRaffleABI from '@/abi/ZkAssetRaffle.json';

export const CONTRACTS_BY_CHAIN = {
  sepolia: {
    raffle: (process.env.NEXT_PUBLIC_SEPOLIA_RAFFLE_CONTRACT_ADDRESS ||
      "0x1234567890123456789012345678901234567890") as `0x${string}`,
  },
  mantleSepoliaTestnet: {
    raffle: (process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_TESTNET_RAFFLE_CONTRACT_ADDRESS ||
      "0x1234567890123456789012345678901234567890") as `0x${string}`,
  },
  arbitrumSepolia: {
    raffle: (process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RAFFLE_CONTRACT_ADDRESS ||
      "0x1234567890123456789012345678901234567890") as `0x${string}`,
  },
} as const;

export const CONTRACT_ABI = ZkAssetRaffleABI;

// 网络配置
export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: "Sepolia",
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_PROJECT_ID",
    blockExplorer: "https://sepolia.etherscan.io",
  },
  mantleSepoliaTestnet: {
    chainId: 5003,
    name: "Mantle Sepolia Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_TESTNET_RPC_URL || "https://rpc.sepolia.mantle.xyz",
    blockExplorer: "https://explorer.sepolia.mantle.xyz",
  },
  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL || "https://arbitrum-sepolia-testnet.api.pocket.network",
    blockExplorer: "https://sepolia.arbiscan.io",
  },
} as const;
