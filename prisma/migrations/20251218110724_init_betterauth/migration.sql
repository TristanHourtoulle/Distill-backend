-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('pending', 'indexing', 'ready', 'error');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('must_do', 'must_not_do', 'convention', 'pattern');

-- CreateEnum
CREATE TYPE "MeetingSource" AS ENUM ('upload', 'paste', 'webhook');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('pending', 'processing', 'completed', 'error');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('feature', 'bugfix', 'modification', 'documentation', 'refactor');

-- CreateEnum
CREATE TYPE "TaskComplexity" AS ENUM ('simple', 'moderate', 'critical');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'analyzing', 'analyzed', 'exported', 'archived');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AgentActionType" AS ENUM ('list_dir', 'read_file', 'search_code', 'get_imports', 'thinking');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('github_issues', 'notion', 'jira', 'linear');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "image" TEXT,
    "github_access_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "id_token" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "github_repo_url" TEXT NOT NULL,
    "github_owner" TEXT NOT NULL,
    "github_repo_name" TEXT NOT NULL,
    "default_branch" TEXT NOT NULL,
    "preferred_branch" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "detected_stack" JSONB,
    "structure_summary" JSONB,
    "status" "ProjectStatus" NOT NULL DEFAULT 'pending',
    "last_indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_rules" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_indexes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "exports" JSONB,
    "imports" JSONB,
    "summary" TEXT,
    "line_count" INTEGER NOT NULL,
    "last_commit_sha" TEXT,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_indexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "raw_content" TEXT NOT NULL,
    "parsed_summary" TEXT,
    "reference_branch" TEXT NOT NULL,
    "source" "MeetingSource" NOT NULL DEFAULT 'paste',
    "metadata" JSONB,
    "status" "MeetingStatus" NOT NULL DEFAULT 'pending',
    "meeting_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TaskType" NOT NULL DEFAULT 'feature',
    "complexity" "TaskComplexity" NOT NULL DEFAULT 'moderate',
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "impacted_files_preview" JSONB,
    "estimated_files_count" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_analyses" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "files_to_create" JSONB,
    "files_to_modify" JSONB,
    "implementation_steps" JSONB,
    "risks" JSONB,
    "dependencies" JSONB,
    "reasoning" TEXT,
    "tokens_used" INTEGER,
    "tool_calls_count" INTEGER,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'running',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "task_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_logs" (
    "id" TEXT NOT NULL,
    "task_analysis_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "action_type" "AgentActionType" NOT NULL,
    "action_input" TEXT,
    "action_output" TEXT,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "config" JSONB,
    "access_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_exports" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "external_id" TEXT,
    "external_url" TEXT,
    "exported_content" JSONB,
    "status" "ExportStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_rules" ADD CONSTRAINT "project_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_indexes" ADD CONSTRAINT "project_indexes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_analyses" ADD CONSTRAINT "task_analyses_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_task_analysis_id_fkey" FOREIGN KEY ("task_analysis_id") REFERENCES "task_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_exports" ADD CONSTRAINT "task_exports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_exports" ADD CONSTRAINT "task_exports_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
