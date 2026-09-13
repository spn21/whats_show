'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, SectionHeader, useToast } from '@/components/ui';
import { useCreateActivity } from '@/hooks/useActivityApi';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Gift } from 'lucide-react';
import { PrizeTierList, PrizeTier } from './PrizeTierList';
import { TicketConfig } from './TicketConfig';
import { ProgressPanel } from './ProgressPanel';
import { useChainAdapter } from '@/chains/useChainAdapter';

export default function CreateRaffleForm() {
  const [raffleName, setRaffleName] = useState('');
  const [prizeTiers, setPrizeTiers] = useState<PrizeTier[]>([
    { name: 'First Prize', quantity: '1', winningPercentage: '10' }
  ]);
  const [ticketCount, setTicketCount] = useState('100');
  const [totalPercentage, setTotalPercentage] = useState<number>(10);
  const [formErrors, setFormErrors] = useState<{
    raffleName?: string;
    prizeTiers?: string;
    ticketCount?: string;
    totalPercentage?: string;
    general?: string;
  }>({});
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState({
    step: '',
    percentage: 0
  });
  
  const { toast } = useToast();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { adapter } = useChainAdapter();
  const { createActivity } = useCreateActivity();

  const addPrizeTier = () => {
    if (prizeTiers.length >= 10) {
      toast({
        title: "Maximum Limit Reached",
        description: "You can create up to 10 prize tiers",
        variant: "destructive",
      });
      return;
    }
    
    const newTier = { 
      name: `Prize ${prizeTiers.length + 1}`, 
      quantity: '1', 
      winningPercentage: '5' 
    };
    setPrizeTiers([...prizeTiers, newTier]);
    calculateTotalPercentage([...prizeTiers, newTier]);
  };

  const insertPrizeTierAfter = (index: number) => {
    if (prizeTiers.length >= 10) {
      toast({
        title: "Maximum Limit Reached",
        description: "You can create up to 10 prize tiers",
        variant: "destructive",
      });
      return;
    }
    const newTier = {
      name: `Prize ${prizeTiers.length + 1}`,
      quantity: '1',
      winningPercentage: '5',
    };
    const next = [...prizeTiers];
    next.splice(index + 1, 0, newTier);
    setPrizeTiers(next);
    calculateTotalPercentage(next);
  };

  const removePrizeTier = (index: number) => {
    const newPrizeTiers = prizeTiers.filter((_, i) => i !== index);
    setPrizeTiers(newPrizeTiers);
    calculateTotalPercentage(newPrizeTiers);
  };

  const updatePrizeTier = (index: number, field: keyof PrizeTier, value: string) => {
    const newPrizeTiers = [...prizeTiers];
    newPrizeTiers[index] = { ...newPrizeTiers[index], [field]: value };
    setPrizeTiers(newPrizeTiers);
    calculateTotalPercentage(newPrizeTiers);
  };

  const calculateTotalPercentage = (tiers: PrizeTier[]) => {
    const total = tiers.reduce((sum, tier) => {
      const percentage = parseFloat(tier.winningPercentage) || 0;
      return sum + percentage;
    }, 0);
    setTotalPercentage(total);
  };

  const handleTicketCountChange = (value: string) => {
    setTicketCount(value);
  };

  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};
    
    // Validate raffle name
    if (!raffleName.trim()) {
      errors.raffleName = "Raffle name is required";
    } else if (raffleName.trim().length < 3) {
      errors.raffleName = "Raffle name must be at least 3 characters";
    } else if (raffleName.trim().length > 100) {
      errors.raffleName = "Raffle name must be less than 100 characters";
    }
    
    // Validate prize tiers
    if (prizeTiers.length === 0) {
      errors.prizeTiers = "At least one prize tier is required";
    } else {
      // Check for empty fields
      const hasEmptyFields = prizeTiers.some(tier => 
        !tier.name.trim() || 
        !tier.quantity.trim() || 
        !tier.winningPercentage.trim()
      );
      
      if (hasEmptyFields) {
        errors.prizeTiers = "All prize tier fields are required";
      } else {
        // Check for invalid quantities and percentages
        const hasInvalidQuantity = prizeTiers.some(tier => {
          const qty = parseInt(tier.quantity);
          return isNaN(qty) || qty < 1;
        });
        
        const hasInvalidPercentage = prizeTiers.some(tier => {
          const pct = parseFloat(tier.winningPercentage);
          return isNaN(pct) || pct <= 0;
        });
        
        if (hasInvalidQuantity) {
          errors.prizeTiers = "All quantities must be positive numbers";
        } else if (hasInvalidPercentage) {
          errors.prizeTiers = "All winning percentages must be positive numbers";
        }
      }
    }
    
    // Validate total percentage
    if (totalPercentage <= 0) {
      errors.totalPercentage = "Total winning percentage must be greater than 0";
    } else if (totalPercentage > 100) {
      errors.totalPercentage = "Total winning percentage cannot exceed 100%";
    }
    
    // Validate ticket count
    const count = parseInt(ticketCount);
    if (isNaN(count) || count < 1 || count > 10000) {
      errors.ticketCount = "Ticket count must be between 1 and 10,000";
    }
    
    setFormErrors(errors);
    
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      const firstError = Object.values(errors)[0];
      toast({
        title: "Validation Error",
        description: firstError || "Please check the form and try again",
        variant: "destructive",
      });
    }
    
    return !hasErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFormErrors({});
    
    // Validate form
    if (!validateForm()) {
      return;
    }

    // Check wallet connection
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
    
    setIsCreating(true);
    
    try {
      // Step 1: Create activity on backend (25%)
      setCreationProgress({ step: 'Creating raffle on backend...', percentage: 25 });
      
      const prizes = prizeTiers.map(tier => ({
        name: tier.name,
        count: parseInt(tier.quantity),
        winning_percentage: parseFloat(tier.winningPercentage)
      }));
      
      const activityData = {
        name: raffleName.trim(),
        total_items: parseInt(ticketCount),
        prizes: prizes,
        creator_address: address,
      };
      
      const response = await createActivity(activityData);
      
      if (response.status !== 'success') {
        throw new Error(response.message || 'Failed to create activity');
      }

      const activityId = response.activity_id!;
      const merkleRoot = response.merkle_root!;
      
      // Step 2: Create raffle on blockchain (50%)
      setCreationProgress({ step: 'Creating raffle on blockchain...', percentage: 50 });

      await adapter.createRaffle(activityId, parseInt(ticketCount));
      
      // Step 3: Commit raffle on blockchain (75%)
      setCreationProgress({ step: 'Committing merkle root to blockchain...', percentage: 75 });
      
      const merkleRootBytes32 = merkleRoot.startsWith('0x') 
        ? merkleRoot as `0x${string}`
        : `0x${merkleRoot}` as `0x${string}`;

      await adapter.commitRaffle(activityId, merkleRootBytes32);
      
      // Step 4: Complete (100%)
      setCreationProgress({ step: 'Raffle created successfully!', percentage: 100 });
      
      toast({
        title: "Success", 
        description: "Raffle created and committed successfully! Redirecting to admin panel...",
        variant: "default",
      });

      // Redirect to admin page
      setTimeout(() => {
        router.push('/admin');
      }, 2000);

    } catch (error) {
      console.error('Error creating raffle:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message.includes('fetch') 
          ? "Cannot connect to backend server. Please ensure the backend is running."
          : error.message.includes('User rejected')
          ? "Transaction was rejected by user"
          : error.message
        : "Failed to create raffle";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      setCreationProgress({ step: '', percentage: 0 });
      setIsCreating(false);
    }
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 py-6 sm:py-8">
          
          <div className="space-y-6">
            <SectionHeader icon={<Gift className="h-5 w-5" />} title="Raffle Name" colorClass="primary" />
              <Input
                placeholder="e.g., Summer Lucky Draw 2024"
                value={raffleName}
                onChange={(e) => setRaffleName(e.target.value)}
                required
              />
              {formErrors.raffleName && (
                <p className="text-xs text-destructive">{formErrors.raffleName}</p>
              )}
          </div>
          
          <PrizeTierList
            prizeTiers={prizeTiers}
            error={formErrors.prizeTiers}
            onAdd={addPrizeTier}
            onInsertAfter={insertPrizeTierAfter}
            onRemove={removePrizeTier}
            onUpdate={updatePrizeTier}
          />
            
            {formErrors.totalPercentage && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{formErrors.totalPercentage}</p>
              </div>
            )}
          
          
          <TicketConfig
            ticketCount={ticketCount}
            onChange={handleTicketCountChange}
            error={formErrors.ticketCount}
          />
          
          
          {isCreating && (
            <ProgressPanel step={creationProgress.step} percentage={creationProgress.percentage} />
          )}
          
          
          <div className="pt-4">
            <Button 
              type="submit" 
              variant="gradient"
              className="w-full h-11"
              disabled={isCreating}
            >
              {isCreating ? 'Creating Raffle...' : 'Create & Deploy Raffle'}
            </Button>
          </div>
    </form>
  );

  return content;
}
