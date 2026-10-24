// Original Attachment Manager runtime keys are absent from the 102-key catalog.
// Template consumers use their own fallback after global < operator overrides;
// direct PDF-template reads retain empty values until HTTP's omission rule.
export const originalAttachmentTextFallbacks = {
  am_sidebar_button: "Seiteleiste",
  am_capture_image: "Seite aufnehmen",
  am_available_cameras: "Verfügbare Cameras",
  gm_flash_checkbox: "Blitz",
  am_goto_attachment_overview: "Zurück zur Übersicht",
  am_capture_image_instructions: "Halten Sie die Seite so in die Kamera, dass der aufgedruckte QR-Code in der oberen linken Ecke liegt",
  "am_attachment_type_capture-image": "Foto einer Seite",
  am_button_delete_attachment: "Anhang Löschen",
  am_tools_headline: "Werkzeuge",
  am_add_button: "Anhang hinzufügen",
  am_add_headline: "Anhang hinzufügen"
} as const;

export type AttachmentCustomTextKey = keyof typeof originalAttachmentTextFallbacks;

export const attachmentTextValue = (
  globalTexts: Readonly<Record<string, string>> | null | undefined,
  operatorTexts: Readonly<Record<string, string>> | null | undefined,
  key: AttachmentCustomTextKey | "am_page_template_label"
): string => operatorTexts?.[key] ?? globalTexts?.[key] ?? "";

export const resolveAttachmentText = (
  globalTexts: Readonly<Record<string, string>> | null | undefined,
  operatorTexts: Readonly<Record<string, string>> | null | undefined,
  key: AttachmentCustomTextKey,
  fallback: string = originalAttachmentTextFallbacks[key]
): string => attachmentTextValue(globalTexts, operatorTexts, key) || fallback;
