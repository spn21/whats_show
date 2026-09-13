export interface QRData {
  sid: string;
  encrypted_data: string;
  raffleId?: string;
  activity_id?: string;
}

export interface ClaimResult {
  success: boolean;
  message: string;
  txHash?: string;
}
