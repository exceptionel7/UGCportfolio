import "server-only";

/**
 * Email sending (Phase 12).
 *
 * STATUS: NOT CONNECTED unless RESEND_API_KEY is set.
 * When no key is present this NEVER pretends to send — it logs the intended
 * email server-side and returns { sent:false, reason:"NOT_CONNECTED" }.
 * When a key is present it sends via Resend.
 */
type SendResult = { sent: boolean; reason?: string; id?: string };

const FROM = process.env.EMAIL_FROM || "Exceptionel <onboarding@resend.dev>";

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:NOT_CONNECTED] would send "${subject}" to ${to}`);
    return { sent: false, reason: "NOT_CONNECTED" };
  }
  try {
    // Lazy import so the app builds/runs even before the dep/key exist.
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) return { sent: false, reason: String(error) };
    return { sent: true, id: data?.id };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";

export function sendVerificationEmail(to: string, token: string) {
  const url = `${appUrl()}/api/verify-email?token=${encodeURIComponent(token)}`;
  return send(to, "Verify your Exceptionel account", `<p>Welcome to Exceptionel.</p><p>Confirm your email: <a href="${url}">Verify email</a></p>`);
}

export function sendPasswordResetEmail(to: string, token: string) {
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return send(to, "Reset your Exceptionel password", `<p>Reset your password: <a href="${url}">Choose a new password</a></p><p>If you didn't request this, ignore this email.</p>`);
}

export function sendNotificationEmail(to: string, subject: string, message: string) {
  return send(to, subject, `<p>${message}</p>`);
}
