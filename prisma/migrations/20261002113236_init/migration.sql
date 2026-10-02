-- CreateEnum
CREATE TYPE "Readiness" AS ENUM ('DRAFT', 'READY_FOR_RELEASE', 'NOT_READY');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "StatementKind" AS ENUM ('CLASSIFICATION', 'GAP', 'UNSUPPORTED_CLAIM', 'RISK', 'TECH_SUMMARY', 'STAKEHOLDER_SUMMARY');

-- CreateEnum
CREATE TYPE "Impact" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseVersion" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "package" JSONB NOT NULL,
    "itemHashes" JSONB NOT NULL,
    "checkResults" JSONB NOT NULL,
    "readiness" "Readiness" NOT NULL DEFAULT 'DRAFT',
    "readinessBy" TEXT,
    "readinessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL,
    "model" TEXT NOT NULL,
    "promptVer" TEXT NOT NULL,
    "promptHash" TEXT,
    "durationMs" INTEGER,
    "error" TEXT,
    "rawOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "runId" TEXT,
    "kind" "StatementKind" NOT NULL,
    "impact" "Impact",
    "severity" "Severity",
    "text" TEXT NOT NULL,
    "editedText" TEXT,
    "citations" JSONB NOT NULL,
    "uncited" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "staleReason" TEXT,
    "carriedFrom" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "statementIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseVersion_releaseId_versionNumber_key" ON "ReleaseVersion"("releaseId", "versionNumber");

-- AddForeignKey
ALTER TABLE "ReleaseVersion" ADD CONSTRAINT "ReleaseVersion_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ReleaseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ReleaseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ReleaseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
