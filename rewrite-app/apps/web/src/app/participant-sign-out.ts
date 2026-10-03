export async function performParticipantSignOut(input: {
  participantSessionId: string;
  readCredential: (sessionId: string) => string | null;
  revoke: (sessionId: string, token: string) => Promise<unknown>;
  forgetCredential: (sessionId: string, expectedToken: string) => boolean;
  readActiveSessionId?: () => string;
  clearSignedInState: () => void;
}): Promise<"signed_out" | "renewed" | "replaced"> {
  const token = input.readCredential(input.participantSessionId);
  if (!token) throw new Error("Participant access is unavailable.");
  await input.revoke(input.participantSessionId, token);
  // A different tab/login may renew this exact participant while logout is
  // in flight. Never erase that newer credential or its visible session.
  const current = input.readCredential(input.participantSessionId);
  if (current && current !== token) return "renewed";
  if (!input.forgetCredential(input.participantSessionId, token)) {
    const renewed = input.readCredential(input.participantSessionId);
    if (renewed && renewed !== token) return "renewed";
  }
  if (input.readActiveSessionId && input.readActiveSessionId() !== input.participantSessionId) return "replaced";
  // A quota failure cannot restore access: the server has revoked this token.
  // Clearing the view must not delete foreground/worker answer queues.
  input.clearSignedInState();
  return "signed_out";
}
