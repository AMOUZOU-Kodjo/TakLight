-- Add deleted_for column to messages
ALTER TABLE "messages" ADD COLUMN "deleted_for" TEXT;
