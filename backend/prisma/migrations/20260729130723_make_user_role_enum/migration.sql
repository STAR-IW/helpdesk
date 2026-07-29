-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'agent');

-- AlterTable (cast existing text values into the enum instead of drop+recreate, to avoid data loss)
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'agent';