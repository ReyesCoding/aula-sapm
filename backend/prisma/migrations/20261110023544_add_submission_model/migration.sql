-- CreateTable
CREATE TABLE "Submission" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "grade" INTEGER,
    "feedback" TEXT,
    "submissionUrl" TEXT,
    "submissionComment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_assignmentId_idx" ON "Submission"("assignmentId");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assignmentId_studentId_key" ON "Submission"("assignmentId", "studentId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: antes de borrar las columnas de entrega de "Assignment",
-- preservamos como filas de "Submission" cualquier entrega que ya exista en
-- la base de datos (studentId seteado + status SUBMITTED/GRADED). Sin este
-- paso se perdería cualquier entrega o calificación ya cargada.
INSERT INTO "Submission" ("assignmentId", "studentId", "status", "grade", "feedback", "submissionUrl", "submissionComment", "submittedAt", "gradedAt", "createdAt", "updatedAt")
SELECT
    "id",
    "studentId",
    "status",
    "grade",
    "feedback",
    "submissionUrl",
    "submissionComment",
    "updatedAt",
    CASE WHEN "status" = 'GRADED' THEN "updatedAt" ELSE NULL END,
    "createdAt",
    "updatedAt"
FROM "Assignment"
WHERE "studentId" IS NOT NULL AND "status" IN ('SUBMITTED', 'GRADED');

-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "status",
DROP COLUMN "grade",
DROP COLUMN "submissionUrl",
DROP COLUMN "submissionComment",
DROP COLUMN "feedback",
DROP COLUMN "fileUrl";
