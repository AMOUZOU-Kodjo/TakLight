-- Add reply_to_id to messages
ALTER TABLE "messages" ADD COLUMN "reply_to_id" TEXT;

-- Add foreign key constraint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
