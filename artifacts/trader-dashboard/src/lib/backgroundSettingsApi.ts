import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export type BackgroundUploadResult = {
  url: string;
};

export function uploadBackgroundImage(file: File, options?: RelativeApiOptions): Promise<BackgroundUploadResult> {
  const form = new FormData();
  form.append("image", file);
  return apiJSON<BackgroundUploadResult>("settings/background", { method: "POST", body: form }, options);
}
