declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;

  export interface WorkflowEvent<T> {
    payload: T;
  }

  export interface WorkflowStep {
    do<T>(name: string, callback: () => Promise<T>): Promise<T>;
  }

  export abstract class WorkflowEntrypoint<Env, Params> {
    constructor(context: unknown, env: Env);
    abstract run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<void>;
  }
}
