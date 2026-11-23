// Defaults from the pinned IQB Testcenter AppConfig. See ORIGINAL-UI-LICENSE.txt.
export const originalNoticeDefaults = {
  legalNoticeHtml: '<p>Anbieter:<br>Max Mustermann<br>Musterstraße 1<br>13088 Berlin<br>' +
    '<br>Kontakt:<br>Telefon: 030/1234567-8<br>Telefax: 030/1234567-9<br>E-Mail: mail@mustermann.de' +
    '<br>Website: www.mustermann.de</p>',
  privacyNotice: 'privacyNotice text nicht definiert',
  accessibilityNotice: 'accessibilityNotice text nicht definiert'
} as const;

export type OriginalNoticeKey = keyof typeof originalNoticeDefaults;
