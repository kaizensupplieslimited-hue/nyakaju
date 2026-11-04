import "server-only";

export type ContactMessage = {
  submissionId: string;
  name: string;
  email: string;
  message: string;
};

export type ContactDeliveryResult = {
  status: "sent" | "failed" | "not_configured";
  providerMessageId: string | null;
  error: string | null;
};

const CONTACT_RECIPIENT = "info@thenyakaju.com";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderContactMessage(contact: ContactMessage) {
  const safeName = escapeHtml(contact.name);
  const safeEmail = escapeHtml(contact.email);
  const safeMessage = escapeHtml(contact.message).replaceAll("\n", "<br>");
  const html = `<!doctype html>
<html lang="en" dir="ltr">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New website contact message</title></head>
  <body style="margin:0;background:#f5f3ef;color:#1a1c1c;font-family:Arial,sans-serif">
    <table lang="en" dir="ltr" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3ef;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #ded8ce;border-radius:16px">
          <tr><td style="padding:28px 32px;background:#1a1c1c;color:#ffffff;border-radius:16px 16px 0 0">
            <h1 style="margin:0;font-size:22px">New website enquiry</h1>
          </td></tr>
          <tr><td style="padding:30px 32px;font-size:15px;line-height:1.65">
            <p style="margin:0 0 8px"><strong>From:</strong> ${safeName}</p>
            <p style="margin:0 0 24px"><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color:#675d4b">${safeEmail}</a></p>
            <div style="padding:20px;border-radius:12px;background:#f3f0ea;white-space:normal">${safeMessage}</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = [
    "New website enquiry",
    "",
    `From: ${contact.name}`,
    `Email: ${contact.email}`,
    "",
    contact.message,
  ].join("\n");

  return { html, text };
}

export async function sendContactMessage(contact: ContactMessage): Promise<ContactDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_EMAIL_FROM?.trim() || process.env.BOOKING_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return { status: "not_configured", providerMessageId: null, error: "Contact email is not configured." };
  }

  try {
    const { html, text } = renderContactMessage(contact);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `contact-message/${contact.submissionId}`,
      },
      body: JSON.stringify({
        from,
        to: [CONTACT_RECIPIENT],
        reply_to: contact.email,
        subject: "New website contact message",
        html,
        text,
        tags: [{ name: "source", value: "contact-form" }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };

    if (!response.ok || !payload.id) {
      return {
        status: "failed",
        providerMessageId: null,
        error: (payload.message || `Email provider returned ${response.status}.`).slice(0, 1_000),
      };
    }

    return { status: "sent", providerMessageId: payload.id, error: null };
  } catch (error) {
    return {
      status: "failed",
      providerMessageId: null,
      error: (error instanceof Error ? error.message : "Contact email delivery failed.").slice(0, 1_000),
    };
  }
}
