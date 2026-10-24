/** Explicit URL attribution only: no cross-account persistent tracking. */
export function validAcademyReferral(value: string | null): string | null {
  return value && /^AC[A-F0-9]{16}$/i.test(value) ? value.toUpperCase() : null;
}
export function academyAuthDestination(search: string): string | null {
  const params = new URLSearchParams(search);
  if (params.get("academy") !== "1") return null;
  const code = validAcademyReferral(params.get("academy_ref"));
  return code ? `/academy?tab=introduction&ref=${code}` : "/academy?tab=introduction";
}
