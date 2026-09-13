export type ChainType = "evm" | "sui";

export interface ChainConfig {
  key: string;
  name: string;
  chainType: ChainType;
  chainId?: number;
  rpcUrl?: string;
  explorerUrl?: string;
  contracts?: {
    raffle?: `0x${string}`;
  };
}

export interface RaffleView {
  state: number | null;
  creator?: string;
  keyRevealed?: boolean;
}

export interface TicketClaimView {
  claimer?: string;
  isRedeemed: boolean;
}

export interface ChainAdapter {
  chainType: ChainType;
  chainKey: string;
  address?: string;
  isConnected: boolean;
  createRaffle: (raffleId: string, totalItems: number) => Promise<`0x${string}`>;
  commitRaffle: (raffleId: string, merkleRoot: `0x${string}`) => Promise<`0x${string}`>;
  revealKey: (raffleId: string, encryptionKey: string) => Promise<`0x${string}`>;
  claimTicket: (raffleId: string, sid: string, encryptedData: string) => Promise<`0x${string}`>;
  redeemPrize: (
    raffleId: string,
    sid: string,
    r_i: string,
    win_i: number,
    proof: `0x${string}`[]
  ) => Promise<`0x${string}`>;
  getRaffle: (raffleId: string) => Promise<RaffleView>;
  getTicketClaim: (raffleId: string, sid: string) => Promise<TicketClaimView>;
}
