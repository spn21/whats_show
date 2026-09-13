"use client";

import { useCallback, useState } from "react";
import { trpc } from "@/utils/trpc";
import type {
  ApiResponse,
  ActivityItemsResponse,
  ActivityItemResponse,
  ActivityListResponse,
  ActivityStatusResponse,
  CreateActivityRequest,
  CreateActivityResponse,
  RevealResponse
} from "@zk-asset-raffle/types";

function errorResponse<T extends ApiResponse>(error: unknown): T {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Unknown error occurred"
  } as T;
}

export function useCreateActivity() {
  const mutation = trpc.activity.create.useMutation();
  const createActivity = useCallback(
    async (data: CreateActivityRequest): Promise<CreateActivityResponse> => {
      try {
        return await mutation.mutateAsync(data);
      } catch (error) {
        return errorResponse<CreateActivityResponse>(error);
      }
    },
    [mutation]
  );

  return {
    createActivity,
    isCreating: mutation.isPending,
    error: mutation.error
  };
}

export function useRevealActivity() {
  const mutation = trpc.activity.reveal.useMutation();
  const revealActivity = useCallback(
    async (activityId: string): Promise<RevealResponse> => {
      try {
        return await mutation.mutateAsync({ activityId });
      } catch (error) {
        return errorResponse<RevealResponse>(error);
      }
    },
    [mutation]
  );

  return {
    revealActivity,
    isRevealing: mutation.isPending,
    error: mutation.error
  };
}

export function useDeleteActivity() {
  const mutation = trpc.activity.delete.useMutation();
  const deleteActivity = useCallback(
    async (activityId: string): Promise<ApiResponse> => {
      try {
        return await mutation.mutateAsync({ activityId });
      } catch (error) {
        return errorResponse<ApiResponse>(error);
      }
    },
    [mutation]
  );

  return {
    deleteActivity,
    isDeleting: mutation.isPending,
    error: mutation.error
  };
}

export function useActivitiesByCreator(address?: string, enabled = true) {
  const query = trpc.activity.listByCreator.useQuery(
    { address: address ?? "" },
    { enabled: Boolean(address) && enabled }
  );

  return {
    data: query.data as ActivityListResponse | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  };
}

export function useActivityStatus(activityId?: string, enabled = true) {
  const query = trpc.activity.status.useQuery(
    { activityId: activityId ?? "" },
    { enabled: Boolean(activityId) && enabled }
  );

  return {
    data: query.data as ActivityStatusResponse | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  };
}

export function useActivityItemsFetcher() {
  const utils = trpc.useUtils();
  const [isFetching, setIsFetching] = useState(false);

  const fetchActivityItems = useCallback(
    async (activityId: string): Promise<ActivityItemsResponse> => {
      setIsFetching(true);
      try {
        return await utils.activity.items.fetch({ activityId });
      } catch (error) {
        return errorResponse<ActivityItemsResponse>(error);
      } finally {
        setIsFetching(false);
      }
    },
    [utils]
  );

  return { fetchActivityItems, isFetching };
}

export function useItemBySidFetcher() {
  const utils = trpc.useUtils();
  const [isFetching, setIsFetching] = useState(false);

  const fetchItemBySid = useCallback(
    async (activityId: string, sid: string): Promise<ActivityItemResponse> => {
      setIsFetching(true);
      try {
        return await utils.activity.itemBySid.fetch({ activityId, sid });
      } catch (error) {
        return errorResponse<ActivityItemResponse>(error);
      } finally {
        setIsFetching(false);
      }
    },
    [utils]
  );

  return { fetchItemBySid, isFetching };
}
