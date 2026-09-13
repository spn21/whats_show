'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Ticket as TicketIcon, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Modal, useToast } from '@/components/ui';
import { useItemBySidFetcher } from '@/hooks/useActivityApi';
import { ActionPanel } from './ActionPanel';
import type { QRCodeClaimProps } from '@/types/ui';
import { useChainAdapter } from '@/chains/useChainAdapter';

export default function ClaimTicketPanel({ qrData, onClaimSuccess, autoCheckStatus = false }: QRCodeClaimProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [onChainStatus, setOnChainStatus] = useState<{
    isClaimed: boolean;
    isRedeemed: boolean;
    canRedeem: boolean;
  } | null>(null);
  //

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { adapter } = useChainAdapter();
  const { toast } = useToast();
  const [redeemInfo, setRedeemInfo] = useState<{ open: boolean; winLevel: number; txHash?: `0x${string}` } | null>(null);
  const { fetchItemBySid } = useItemBySidFetcher();
  const [raffleState, setRaffleState] = useState<number | null>(null);

  // Determine raffleId from payload
  const raffleId = qrData.raffleId || qrData.activity_id;

  // Helper function to get state display text
  //

  // Check on-chain status for this ticket
  const checkOnChainStatus = React.useCallback(async () => {
    if (!raffleId) return;

    setIsCheckingStatus(true);
    try {
      const [raffle, ticketClaim] = await Promise.all([
        adapter.getRaffle(raffleId),
        adapter.getTicketClaim(raffleId, qrData.sid),
      ]);
      setRaffleState(raffle.state);

      const isClaimed = Boolean(
        ticketClaim.claimer &&
          ticketClaim.claimer !== '0x0000000000000000000000000000000000000000'
      );
      const canRedeem = raffle.state === 2;

      setOnChainStatus({
        isClaimed,
        isRedeemed: ticketClaim.isRedeemed,
        canRedeem
      });

      //

    } catch (error) {
      console.error('Failed to check on-chain status:', error);
      toast({
        title: "Error",
        description: "Failed to check ticket status on-chain",
        variant: "destructive",
      });
    } finally {
      setIsCheckingStatus(false);
    }
  }, [adapter, raffleId, qrData.sid, toast]);

  // Auto-check status when component loads
  React.useEffect(() => {
    if (!autoCheckStatus) return;
    if (raffleId) {
      checkOnChainStatus();
    }
  }, [autoCheckStatus, raffleId, checkOnChainStatus]);

  const handleClaim = async () => {
    if (!isConnected || !address) {
      if (openConnectModal) {
        openConnectModal();
        return;
      } else {
        toast({
          title: "Error",
          description: "Please connect your wallet first",
          variant: "destructive",
        });
        return;
      }
    }

    setIsProcessing(true);

    try {
      const raffleId = qrData.raffleId || qrData.activity_id;
      if (!raffleId) {
        throw new Error('Missing raffleId/activity_id in QR data');
      }
      
      // Call the claimTicket function on the ZkAssetRaffle contract
      const hash = await adapter.claimTicket(raffleId, qrData.sid, qrData.encrypted_data);

      const updatedRaffle = await adapter.getRaffle(raffleId);
      const updatedState = updatedRaffle.state ?? 0;
      setRaffleState(updatedRaffle.state);

      const result = {
        success: true,
        message: updatedState === 2 
          ? 'Claimed! Raffle revealed — check and redeem.'
          : updatedState === 3
          ? 'Claimed! Raffle closed — check result.'
          : 'Claimed! Waiting for reveal to see result.',
        txHash: hash
      };

      if (onClaimSuccess) {
        onClaimSuccess(result);
      }

      // Refresh on-chain ticket status after successful claim
      await checkOnChainStatus();

      toast({
        title: "Claim submitted",
        description: `Tx: ${result.txHash.substring(0, 10)}... (view on Etherscan)`,
        variant: "success",
      });

    } catch (error) {
      console.error('Claim error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to claim';

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle redeem (fetch proof from backend and redeem)
  const handleRedeem = async () => {
    if (!isConnected || !address) {
      if (openConnectModal) {
        openConnectModal();
        return;
      } else {
        toast({
          title: "Error",
          description: "Please connect your wallet first",
          variant: "destructive",
        });
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Fetch proof and win data from backend
      const itemResponse = await fetchItemBySid(raffleId as string, qrData.sid);
      
      if (itemResponse.status !== 'success' || !itemResponse.r_i || typeof itemResponse.win_i !== 'number') {
        throw new Error('Raffle not yet revealed or item data not available');
      }

      const { r_i, win_i, proof } = itemResponse;
      
      // Convert proof format
      const formattedProof = proof ? proof.map(p => `0x${p.data}`) : [];

      // Call redeemPrize function
      const hash = await adapter.redeemPrize(raffleId, qrData.sid, r_i, win_i, formattedProof);

      // Update on-chain status
      await checkOnChainStatus();

      toast({
        title: "Redeem success",
        description: `Tx: ${hash.substring(0, 10)}... (view on Etherscan)`,
        variant: "success",
      });

      setRedeemInfo({ open: true, winLevel: win_i, txHash: hash });

    } catch (error) {
      console.error('Redeem error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to redeem';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
          <TicketIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Ticket Ready</span>
        </div>
        <div className="mt-2 text-[11px] sm:text-xs text-muted-foreground">
          SID: <span className="font-mono">{qrData.sid.slice(0, 8)}...</span>
          {raffleId ? (
            <> · Raffle: <span className="font-mono">{(raffleId as string).slice(0, 8)}...</span></>
          ) : null}
        </div>
      </motion.div>

      <div className="max-w-2xl mx-auto">
        <div className="space-y-6">
          <ActionPanel
            status={onChainStatus}
            isProcessing={isProcessing}
            isChecking={isCheckingStatus}
            onClaim={handleClaim}
            onRedeem={handleRedeem}
            onRefresh={checkOnChainStatus}
            canClaim={Boolean(raffleId) && (raffleState === 1 || raffleState === 2)}
          />

          {!isConnected && (
            <div className="text-center p-3 bg-accent/5 border border-accent/20 rounded-lg text-muted-foreground text-sm">
              <div className="inline-flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Please connect your wallet to proceed
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Redeem result modal */}
      <Modal
        open={Boolean(redeemInfo?.open)}
        onClose={() => setRedeemInfo(null)}
        title={redeemInfo && redeemInfo.winLevel > 0 ? 'Congratulations!' : 'Result'}
        maxWidthClass="max-w-md"
      >
        {redeemInfo && (
          <div className="relative overflow-hidden">
            {redeemInfo.winLevel > 0 ? (
              <div className="space-y-4 text-center">
                <div className="text-4xl">🎉🎊✨</div>
                <h3 className="text-xl font-bold gradient-text">You won Prize Level {redeemInfo.winLevel}!</h3>
                <p className="text-sm text-muted-foreground">Your redemption is recorded on-chain.</p>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <div className="text-3xl">🙂</div>
                <h3 className="text-lg font-semibold">No prize this time</h3>
                <p className="text-sm text-muted-foreground">Redemption recorded on-chain. Better luck next time!</p>
              </div>
            )}
            {redeemInfo.txHash && (
              <div className="mt-4 text-center text-xs">
                <a
                  className="underline text-accent"
                  href={`https://sepolia.etherscan.io/tx/${redeemInfo.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
