import { supabase } from "@/integrations/supabase/client";

const BUCKET = "payment-slips";

/** Extract the storage object path from either a raw path or a legacy public URL. */
export const extractSlipPath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  // Legacy public URL: .../storage/v1/object/public/payment-slips/<path>
  const marker = `/${BUCKET}/`;
  const idx = v.indexOf(marker);
  if (idx >= 0 && /^https?:\/\//i.test(v)) {
    return v.slice(idx + marker.length).split("?")[0];
  }
  return v;
};

/** Create a short-lived signed URL for a payment slip. Returns null if not resolvable. */
export const signPaymentSlip = async (
  value: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> => {
  const path = extractSlipPath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};
