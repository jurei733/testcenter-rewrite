// Messages from the pinned Original LoginComponent.loginObserver.
export function nativeLoginProblemText(status: number): string | undefined {
  switch (status) {
    case 400: return 'Anmeldedaten sind nicht gültig. Bitte noch einmal versuchen!';
    case 401: return 'Anmeldung abgelehnt. Anmeldedaten sind noch nicht freigeben.';
    case 204: return 'Anmeldedaten sind gültig, aber es sind keine Arbeitsbereiche oder Tests freigegeben.';
    case 410: return 'Anmeldedaten sind abgelaufen';
    case 429: return 'Zu viele Fehlversuche! Probieren Sie es zu einem späteren Zeitpunkt noch einmal.';
    default: return undefined;
  }
}
