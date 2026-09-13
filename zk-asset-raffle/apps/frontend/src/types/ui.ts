import type { ClaimResult, QRData } from "@/types/domain";

export interface QRCodeClaimProps {
  qrData: QRData;
  onClaimSuccess?: (result: ClaimResult) => void;
  autoCheckStatus?: boolean;
}

export interface RevealKeyComponentProps {
  raffleId: string;
  onRevealSuccess?: (result: { success: boolean; message: string; txHash?: string }) => void;
}
