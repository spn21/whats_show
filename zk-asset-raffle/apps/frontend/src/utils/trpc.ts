import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@zk-asset-raffle/trpc";

export const trpc = createTRPCReact<AppRouter>();
