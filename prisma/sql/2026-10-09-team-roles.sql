-- Team roles: a "team" role for Lux Catalog staff, and the areas each team
-- member (and pending invitation) may access. Additive only; safe to re-run.

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'team';

-- AlterTable
ALTER TABLE "StaffInvitation" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
