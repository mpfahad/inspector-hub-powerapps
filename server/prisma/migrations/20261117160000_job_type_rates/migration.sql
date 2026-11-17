-- Job type: day rate, hour rate, default hours (CM-036)
ALTER TABLE "JobType" ADD COLUMN "dayRateUsd" REAL;
ALTER TABLE "JobType" ADD COLUMN "hourRateUsd" REAL;
ALTER TABLE "JobType" ADD COLUMN "defaultHours" REAL;

-- Backfill day rate from legacy defaultPriceUsd; default 8h when a day rate exists
UPDATE "JobType" SET "dayRateUsd" = "defaultPriceUsd" WHERE "dayRateUsd" IS NULL AND "defaultPriceUsd" IS NOT NULL;
UPDATE "JobType" SET "defaultHours" = 8 WHERE "defaultHours" IS NULL AND "dayRateUsd" IS NOT NULL;
UPDATE "JobType" SET "hourRateUsd" = ROUND("dayRateUsd" / "defaultHours", 2)
  WHERE "hourRateUsd" IS NULL AND "dayRateUsd" IS NOT NULL AND "defaultHours" IS NOT NULL AND "defaultHours" > 0;
