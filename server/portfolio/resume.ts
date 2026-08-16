import { getSupabaseClient } from "@/server/supabase/client";

export async function downloadResume(userId: string, portfolioId: string): Promise<Blob | null> {
  const { data, error } = await getSupabaseClient()
    .from("portfolios")
    .select("resume_pdf_path")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.resume_pdf_path) {
    return null;
  }

  const { data: file, error: storageError } = await getSupabaseClient()
    .storage
    .from("resumes")
    .download(data.resume_pdf_path);

  return storageError || !file ? null : file;
}
