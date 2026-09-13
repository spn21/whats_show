"use client";

import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { CONTRACT_ABI } from "@/config/contracts";
import { getChainConfig } from "@/chains/registry";
import { base64ToHex0x, sidToBytes32 } from "@/utils/raffle";
import type { ChainAdapter, RaffleView, TicketClaimView } from "@/chains/types";

export function useEvmAdapter(chainKey: string): ChainAdapter {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const chainConfig = getChainConfig(chainKey as never);
  const raffleAddress = chainConfig.contracts?.raffle;

  const requireClient = () => {
    if (!publicClient) {
      throw new Error("Public client is not available");
    }
    return publicClient;
  };

  const requireRaffleAddress = () => {
    if (!raffleAddress) {
      throw new Error(`Raffle contract is not configured for chain ${chainKey}`);
    }
    return raffleAddress;
  };

  const waitForTx = async (hash: `0x${string}`) => {
    const client = requireClient();
    await client.waitForTransactionReceipt({ hash });
  };

  const normalizeRaffle = (data: unknown): RaffleView => {
    let state: number | null = null;
    let creator: string | undefined;
    let keyRevealed: boolean | undefined;

    if (typeof data === "object" && data !== null) {
      const rec = data as Record<string, unknown>;
      if (typeof rec.state !== "undefined") state = Number(rec.state as number);
      if (typeof rec.creator === "string") creator = rec.creator;
      if (typeof rec.keyRevealed === "boolean") keyRevealed = rec.keyRevealed;
    } else if (Array.isArray(data)) {
      const arr = data as unknown[];
      if (typeof arr[3] !== "undefined") state = Number(arr[3] as number);
      if (typeof arr[0] === "string") creator = arr[0];
      if (typeof arr[4] === "boolean") keyRevealed = arr[4];
    }

    return { state, creator, keyRevealed };
  };

  const normalizeTicketClaim = (data: unknown): TicketClaimView => {
    let claimer: string | undefined;
    let isRedeemed = false;

    if (typeof data === "object" && data !== null) {
      const rec = data as Record<string, unknown>;
      if (typeof rec.claimer === "string") claimer = rec.claimer;
      if (typeof rec.isRedeemed === "boolean") isRedeemed = rec.isRedeemed;
    } else if (Array.isArray(data)) {
      const arr = data as unknown[];
      if (typeof arr[0] === "string") claimer = arr[0];
      if (typeof arr[2] === "boolean") isRedeemed = arr[2];
    }

    return { claimer, isRedeemed };
  };

  return {
    chainType: "evm",
    chainKey,
    address,
    isConnected,
    createRaffle: async (raffleId, totalItems) => {
      const hash = await writeContractAsync({
        address: requireRaffleAddress(),
        abi: CONTRACT_ABI,
        functionName: "createRaffle",
        args: [raffleId, BigInt(totalItems)],
      });
      await waitForTx(hash);
      return hash;
    },
    commitRaffle: async (raffleId, merkleRoot) => {
      const hash = await writeContractAsync({
        address: requireRaffleAddress(),
        abi: CONTRACT_ABI,
        functionName: "commitRaffle",
        args: [raffleId, merkleRoot],
      });
      await waitForTx(hash);
      return hash;
    },
    revealKey: async (raffleId, encryptionKey) => {
      const hash = await writeContractAsync({
        address: requireRaffleAddress(),
        abi: CONTRACT_ABI,
        functionName: "revealKey",
        args: [raffleId, encryptionKey],
      });
      await waitForTx(hash);
      return hash;
    },
    claimTicket: async (raffleId, sid, encryptedData) => {
      const hash = await writeContractAsync({
        address: requireRaffleAddress(),
        abi: CONTRACT_ABI,
        functionName: "claimTicket",
        args: [raffleId, sidToBytes32(sid), base64ToHex0x(encryptedData)],
      });
      await waitForTx(hash);
      return hash;
    },
    redeemPrize: async (raffleId, sid, r_i, win_i, proof) => {
      const hash = await writeContractAsync({
        address: requireRaffleAddress(),
        abi: CONTRACT_ABI,
        functionName: "redeemPrize",
        args: [raffleId, sidToBytes32(sid), r_i, win_i, proof],
      });
      await waitForTx(hash);
      return hash;
    },
    getRaffle: async (raffleId) => {
      const client = requireClient();
      const data = await client.readContract({
        address: requireRaffleAddress(),
        abi: CONTRACT_ABI,
        functionName: "getRaffle",
        args: [raffleId],
      });
      return normalizeRaffle(data);
    },
    getTicketClaim: async (raffleId, sid) => {
      const client = requireClient();
      const data = await client.readContract({
        address: requireRaffleAddress(),
        abi: CONTRACT_ABI,
        functionName: "getTicketClaim",
        args: [raffleId, sidToBytes32(sid)],
      });
      return normalizeTicketClaim(data);
    },
  };
}
