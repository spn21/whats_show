import { httpBatchLink, createTRPCProxyClient } from "@trpc/client";
import type { AppRouter } from "@zk-asset-raffle/trpc";
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

const DEFAULT_TRPC_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_TRPC_URL
    ? process.env.NEXT_PUBLIC_TRPC_URL
    : "http://localhost:5002/trpc";

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: DEFAULT_TRPC_URL
    })
  ]
});

async function safeCall<T extends ApiResponse>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("tRPC request error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error occurred"
    } as T;
  }
}

export const apiService = {
  createActivity(data: CreateActivityRequest): Promise<CreateActivityResponse> {
    return safeCall(() => client.activity.create.mutate(data));
  },

  getActivities(): Promise<ActivityListResponse> {
    return safeCall(() => client.activity.list.query());
  },

  getActivitiesByCreator(address: string): Promise<ActivityListResponse> {
    return safeCall(() => client.activity.listByCreator.query({ address }));
  },

  getActivityStatus(activityId: string): Promise<ActivityStatusResponse> {
    return safeCall(() => client.activity.status.query({ activityId }));
  },

  getActivityItems(activityId: string): Promise<ActivityItemsResponse> {
    return safeCall(() => client.activity.items.query({ activityId }));
  },

  getItemBySid(activityId: string, sid: string): Promise<ActivityItemResponse> {
    return safeCall(() => client.activity.itemBySid.query({ activityId, sid }));
  },

  revealActivity(activityId: string): Promise<RevealResponse> {
    return safeCall(() => client.activity.reveal.mutate({ activityId }));
  },

  deleteActivity(activityId: string): Promise<ApiResponse> {
    return safeCall(() => client.activity.delete.mutate({ activityId }));
  }
};

export type {
  ApiResponse,
  ActivityItemsResponse,
  ActivityItemResponse,
  ActivityListResponse,
  ActivityStatusResponse,
  CreateActivityRequest,
  CreateActivityResponse,
  RevealResponse
};
