"use client";

import { useEvmAdapter } from "@/chains/evmAdapter";
import { DEFAULT_CHAIN_KEY, getChainConfig, type ChainKey } from "@/chains/registry";
import type { ChainAdapter } from "@/chains/types";

export function useChainAdapter(chainKey: ChainKey = DEFAULT_CHAIN_KEY): {
  adapter: ChainAdapter;
  chain: ReturnType<typeof getChainConfig>;
} {
  const chain = getChainConfig(chainKey);
  const adapter = useEvmAdapter(chain.key);

  return { adapter, chain };
}
