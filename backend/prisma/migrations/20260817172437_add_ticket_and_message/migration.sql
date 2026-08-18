-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('generalQuestion', 'technicalQuestion', 'refundRequest');

-- CreateTable
CREATE TABLE "ticket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "category" "TicketCategory",
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_requesterEmail_idx" ON "ticket"("requesterEmail");

-- CreateIndex
CREATE INDEX "ticket_status_idx" ON "ticket"("status");

-- CreateIndex
CREATE INDEX "ticket_category_idx" ON "ticket"("category");

-- CreateIndex
CREATE INDEX "ticket_createdAt_idx" ON "ticket"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "message_messageId_key" ON "message"("messageId");

-- CreateIndex
CREATE INDEX "message_ticketId_idx" ON "message"("ticketId");

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
