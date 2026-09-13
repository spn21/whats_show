import { FastifyInstance } from "fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "@zk-asset-raffle/trpc";
import { prisma } from "./db.js";

export function registerTrpc(server: FastifyInstance) {
  return server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: () => ({ prisma })
    }
  });
}
