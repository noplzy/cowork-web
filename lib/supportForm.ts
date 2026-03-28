export const SUPPORT_FORM_URL =
  process.env.NEXT_PUBLIC_SUPPORT_FORM_URL?.trim() || "";

export function hasSupportFormUrl(): boolean {
  return Boolean(SUPPORT_FORM_URL);
}
