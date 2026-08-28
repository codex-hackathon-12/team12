export type JsonObject = Record<string, unknown>;

export type GenerationStatus = "queued" | "processing" | "completed" | "failed";

export type GenerationStage =
  | "queued"
  | "analyzing_repository"
  | "generating_content"
  | "rendering_portfolio"
  | "completed"
  | "failed";
