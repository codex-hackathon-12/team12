import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { runGenerationJob } from "@/server/generation/runner";

export class GenerationWorkflow extends WorkflowEntrypoint<unknown, { jobId: string }> {
  async run(event: WorkflowEvent<{ jobId: string }>, step: WorkflowStep): Promise<void> {
    await step.do("generate-portfolio", () => runGenerationJob(event.payload.jobId));
  }
}
