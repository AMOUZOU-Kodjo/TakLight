-- CreateEnum
CREATE TYPE "roles" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "roles" NOT NULL DEFAULT 'USER';
