-- CreateEnum
CREATE TYPE "CalendarEventScope" AS ENUM ('CENTER', 'SUBJECT', 'PERSONAL');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "scope" "CalendarEventScope" NOT NULL,
    "subjectId" INTEGER,
    "ownerId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "educationalCenterId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_scope_startsAt_idx" ON "CalendarEvent"("scope", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_subjectId_startsAt_idx" ON "CalendarEvent"("subjectId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_ownerId_startsAt_idx" ON "CalendarEvent"("ownerId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_educationalCenterId_idx" ON "CalendarEvent"("educationalCenterId");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
