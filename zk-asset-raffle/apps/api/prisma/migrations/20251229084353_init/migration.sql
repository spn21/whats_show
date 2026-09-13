-- CreateTable
CREATE TABLE "Activity" (
    "id" VARCHAR(16) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "key" VARCHAR(64),
    "merkleRoot" VARCHAR(128),
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "creatorAddress" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prize" (
    "id" SERIAL NOT NULL,
    "activityId" VARCHAR(16) NOT NULL,
    "prizeConfig" TEXT NOT NULL,

    CONSTRAINT "Prize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "activityId" VARCHAR(16) NOT NULL,
    "sid" VARCHAR(64) NOT NULL,
    "r_i" VARCHAR(64),
    "win_i" INTEGER,
    "leaf" VARCHAR(128),
    "proof" TEXT,
    "encryptedData" TEXT,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_sid_key" ON "Item"("sid");

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
