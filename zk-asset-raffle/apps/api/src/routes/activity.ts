import { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { randomString, shuffle } from "../utils/random.js";
import { encryptAesEcb, decryptAesEcb } from "../utils/crypto.js";
import { buildMerkle, hashLeaf } from "../utils/merkle.js";

type PrizeInput = { name: string; count: number };

type CreateActivityBody = {
  name: string;
  total_items: number;
  prizes: PrizeInput[];
  creator_address?: string | null;
};

function validateCreateBody(body: CreateActivityBody) {
  if (!body || !body.name || !Number.isInteger(body.total_items) || body.total_items <= 0) {
    return "Missing or invalid fields: name, total_items";
  }
  if (!Array.isArray(body.prizes) || body.prizes.length === 0) {
    return "prizes must be a non-empty list";
  }
  for (const prize of body.prizes) {
    if (!prize || typeof prize.name !== "string" || !Number.isInteger(prize.count) || prize.count <= 0) {
      return "Each prize must have name and positive integer count";
    }
  }
  return null;
}

function prepareWinPool(totalItems: number, prizes: { wid: number; count: number }[]) {
  const winPool: number[] = [];
  for (const prize of prizes) {
    winPool.push(...Array(prize.count).fill(prize.wid));
  }
  winPool.push(...Array(totalItems - winPool.length).fill(0));
  return shuffle(winPool);
}

function formatActivity(activity: {
  id: string;
  name: string;
  totalItems: number;
  status: string;
  creatorAddress: string | null;
  createdAt: Date | null;
  prizes: { prizeConfig: string }[];
}) {
  const prizeConfig = activity.prizes[0]?.prizeConfig;
  return {
    activity_id: activity.id,
    name: activity.name,
    total_items: activity.totalItems,
    status: activity.status,
    creator_address: activity.creatorAddress,
    created_at: activity.createdAt ? activity.createdAt.toISOString() : null,
    prizes: prizeConfig ? JSON.parse(prizeConfig) : []
  };
}

export async function registerActivityRoutes(server: FastifyInstance) {
  server.post<{ Body: CreateActivityBody }>("/activity/create", async (request, reply) => {
    try {
      const validationError = validateCreateBody(request.body);
      if (validationError) {
        return reply.status(400).send({ status: "error", message: validationError });
      }

      const { name, total_items, prizes, creator_address } = request.body;
      const totalWinners = prizes.reduce((sum, prize) => sum + prize.count, 0);
      if (totalWinners > total_items) {
        return reply.status(400).send({
          status: "error",
          message: `Total prize count (${totalWinners}) exceeds total items (${total_items})`
        });
      }

      const activityId = randomString(16);
      const key = randomString(32);
      const creatorAddress = (creator_address || "").toLowerCase() || null;

      const prizesWithWid = prizes.map((prize, idx) => ({
        ...prize,
        wid: idx + 1
      }));

      const nothingCount = total_items - totalWinners;
      if (nothingCount > 0) {
        prizesWithWid.unshift({ name: "nothing", count: nothingCount, wid: 0 });
      }

      const winPool = prepareWinPool(total_items, prizesWithWid);

      const items = [] as {
        sid: string;
        leaf: string;
        encryptedData: string;
        proof: string | null;
      }[];
      const leaves: string[] = [];

      for (let i = 0; i < total_items; i += 1) {
        const sid = randomString(16);
        const r_i = randomString(32);
        const win_i = winPool[i];
        const encryptedPayload = JSON.stringify({ r_i, win_i });
        const encryptedData = encryptAesEcb(key, encryptedPayload);
        const leaf = hashLeaf(sid, r_i, win_i);

        items.push({ sid, leaf, encryptedData, proof: null });
        leaves.push(leaf);
      }

      const { root, proofs } = buildMerkle(leaves);
      for (let i = 0; i < items.length; i += 1) {
        items[i].proof = JSON.stringify(proofs[i]);
      }

      await prisma.activity.create({
        data: {
          id: activityId,
          name,
          totalItems: total_items,
          key,
          merkleRoot: root,
          status: "sealed",
          creatorAddress,
          prizes: {
            create: {
              prizeConfig: JSON.stringify(prizesWithWid)
            }
          },
          items: {
            create: items.map((item) => ({
              sid: item.sid,
              leaf: item.leaf,
              encryptedData: item.encryptedData,
              proof: item.proof
            }))
          }
        }
      });

      return {
        status: "success",
        activity_id: activityId,
        key,
        prizes: prizesWithWid,
        merkle_root: root,
        creator_address: creatorAddress,
        message: `Activity created successfully with ${total_items} items`
      };
    } catch (error) {
      request.log.error({ error }, "create activity failed");
      return reply.status(500).send({ status: "error", message: `Internal server error: ${String(error)}` });
    }
  });

  server.get("/activities", async () => {
    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      include: { prizes: true }
    });

    return {
      status: "success",
      activities: activities.map(formatActivity)
    };
  });

  server.get("/activities/by-creator/:address", async (request) => {
    const { address } = request.params as { address: string };
    const addr = (address || "").toLowerCase();

    const activities = await prisma.activity.findMany({
      where: { creatorAddress: addr },
      orderBy: { createdAt: "desc" },
      include: { prizes: true }
    });

    return {
      status: "success",
      activities: activities.map(formatActivity)
    };
  });

  server.get("/activity/:activityId/status", async (request, reply) => {
    const { activityId } = request.params as { activityId: string };
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });

    if (!activity) {
      return reply.status(404).send({ status: "error", message: "Activity not found" });
    }

    return {
      status: "success",
      activity_id: activity.id,
      activity_status: activity.status
    };
  });

  server.get("/activity/:activityId/items", async (request, reply) => {
    const { activityId } = request.params as { activityId: string };
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });

    if (!activity) {
      return reply.status(404).send({ status: "error", message: "Activity not found" });
    }

    const items = await prisma.item.findMany({
      where: { activityId },
      orderBy: { id: "asc" }
    });

    return {
      status: "success",
      items: items.map((item) => ({
        sid: item.sid,
        r_i: item.r_i,
        win_i: item.win_i,
        leaf: item.leaf,
        proof: item.proof ? JSON.parse(item.proof) : null,
        encrypted_data: item.encryptedData
      }))
    };
  });

  server.get("/activity/:activityId/prizes", async (request, reply) => {
    const { activityId } = request.params as { activityId: string };
    const prize = await prisma.prize.findFirst({ where: { activityId } });

    if (!prize) {
      return reply.status(404).send({ status: "error", message: "No prizes found for this activity" });
    }

    return {
      status: "success",
      prizes: JSON.parse(prize.prizeConfig)
    };
  });

  server.get("/activity/:activityId/items/:sid", async (request, reply) => {
    const { activityId, sid } = request.params as { activityId: string; sid: string };
    const item = await prisma.item.findFirst({
      where: { activityId, sid }
    });

    if (!item) {
      return reply.status(404).send({ status: "error", message: "Item not found" });
    }

    return {
      status: "success",
      sid: item.sid,
      r_i: item.r_i,
      win_i: item.win_i,
      leaf: item.leaf,
      proof: item.proof ? JSON.parse(item.proof) : null
    };
  });

  server.post("/activity/:activityId/reveal", async (request, reply) => {
    const { activityId } = request.params as { activityId: string };
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: { items: true }
    });

    if (!activity) {
      return reply.status(404).send({ status: "error", message: "Activity not found" });
    }

    const updates: Prisma.PrismaPromise<unknown>[] = [];

    for (const item of activity.items) {
      if (item.r_i && item.win_i !== null) {
        continue;
      }

      try {
        const decrypted = decryptAesEcb(activity.key ?? "", item.encryptedData ?? "");
        let r_i = "";
        let win_i = 0;

        try {
          const parsed = JSON.parse(decrypted) as { r_i: string; win_i: number };
          r_i = parsed.r_i;
          win_i = parsed.win_i;
        } catch {
          r_i = decrypted.slice(0, 32);
          win_i = Number.parseInt(decrypted.slice(32), 10);
        }

        updates.push(
          prisma.item.update({
            where: { id: item.id },
            data: { r_i, win_i }
          })
        );
      } catch (error) {
        request.log.error({ error, itemId: item.id }, "decrypt item failed");
      }
    }

    updates.push(
      prisma.activity.update({
        where: { id: activityId },
        data: { status: "revealed" }
      })
    );

    await prisma.$transaction(updates);

    return {
      status: "success",
      activity_id: activityId,
      key: activity.key
    };
  });

  server.delete("/activity/:activityId", async (request, reply) => {
    const { activityId } = request.params as { activityId: string };
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });

    if (!activity) {
      return reply.status(404).send({ status: "error", message: "Activity not found" });
    }

    await prisma.$transaction([
      prisma.item.deleteMany({ where: { activityId } }),
      prisma.prize.deleteMany({ where: { activityId } }),
      prisma.activity.delete({ where: { id: activityId } })
    ]);

    return {
      status: "success",
      message: `Activity ${activityId} deleted`
    };
  });
}
