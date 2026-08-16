import { markGenerationJobFailed, runGenerationJob } from "@/server/generation/runner";
import { logOperationFailure } from "@/server/observability/api-logging";

export async function generatePortfolioWorkflow(jobId: string): Promise<void> {
  "use workflow";

  try {
    await runGenerationStep(jobId);
  } catch (error) {
    logOperationFailure({
      domain: "generations",
      operation: "workflow.run",
      jobId,
      error,
    });
    await markGenerationFailedStep(jobId);
  }
}

async function runGenerationStep(jobId: string): Promise<void> {
  "use step";

  await runGenerationJob(jobId);
}

async function markGenerationFailedStep(jobId: string): Promise<void> {
  "use step";

  await markGenerationJobFailed(jobId);
}
