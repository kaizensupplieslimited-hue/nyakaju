import "server-only";

export type ReceiptDeliveryStatus = "sent" | "failed" | "not_configured";

export type BookingReceipt = {
  bookingId: number;
  confirmationCode: string;
  status: string;
  bookedAt: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  roomName: string;
  roomCount: number;
  adults: number;
  children: number;
  arrival: string;
  departure: string;
  nightlyRate: number;
  totalAmount: number;
  currency: string;
};

const DEFAULT_CHECK_IN_TIME = "2:00 PM East Africa Time";
const DEFAULT_REPLY_TO = "info@thenyakaju.com";

export type ReceiptDeliveryResult = {
  status: ReceiptDeliveryStatus;
  providerMessageId: string | null;
  error: string | null;
};

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Kampala",
  }).format(new Date(value));
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function nightsBetween(arrival: string, departure: string) {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`)) / 86_400_000,
    ),
  );
}

function receiptRows(receipt: BookingReceipt) {
  const nights = nightsBetween(receipt.arrival, receipt.departure);
  const checkInTime = process.env.BOOKING_CHECK_IN_TIME?.trim() || DEFAULT_CHECK_IN_TIME;
  return [
    ["Booking submitted", formatDateTime(receipt.bookedAt)],
    ["Guest", `${receipt.guestFirstName} ${receipt.guestLastName}`],
    ["Email", receipt.guestEmail],
    ["Phone", receipt.guestPhone],
    ["Room", receipt.roomName],
    ["Number of rooms", String(receipt.roomCount)],
    ["Occupancy", `${receipt.adults} adult${receipt.adults === 1 ? "" : "s"}, ${receipt.children} child${receipt.children === 1 ? "" : "ren"}`],
    ["Check-in date", formatDate(receipt.arrival)],
    ["Check-in time", checkInTime],
    ["Departure date", formatDate(receipt.departure)],
    ["Length of stay", `${nights} night${nights === 1 ? "" : "s"}`],
    ["Rate per room / night", formatMoney(receipt.nightlyRate, receipt.currency)],
    ["Booking total", formatMoney(receipt.totalAmount, receipt.currency)],
  ] as const;
}

export function renderBookingReceipt(receipt: BookingReceipt) {
  const rows = receiptRows(receipt);
  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #ebe7df;color:#71695e;font-size:13px;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #ebe7df;color:#1a1c1c;font-size:14px;font-weight:600;text-align:right;vertical-align:top">${escapeHtml(value)}</td>
    </tr>`).join("");

  const html = `<!doctype html>
<html lang="en" dir="ltr">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking request ${escapeHtml(receipt.confirmationCode)} received</title></head>
  <body style="margin:0;background:#f5f3ef;color:#1a1c1c;font-family:Montserrat,Arial,sans-serif">
    <div lang="en" dir="ltr" style="display:none;max-height:0;overflow:hidden">Your booking request ${escapeHtml(receipt.confirmationCode)} has been received.</div>
    <table lang="en" dir="ltr" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3ef;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #ded8ce;border-radius:18px;overflow:hidden">
          <tr><td style="background:#1a1c1c;padding:28px 34px;color:#ffffff">
            <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#d8c9ae">The Nyakaju</div>
            <h1 style="margin:14px 0 6px;font-size:26px;line-height:1.25">Booking request received</h1>
            <p style="margin:0;color:#dedbd5;font-size:14px;line-height:1.6">Your request is pending administrator review.</p>
          </td></tr>
          <tr><td style="padding:30px 34px">
            <p style="margin:0 0 8px;color:#71695e;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Booking code</p>
            <p style="margin:0 0 24px;color:#675d4b;font-size:28px;font-weight:700;letter-spacing:.04em">${escapeHtml(receipt.confirmationCode)}</p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.7">Hello ${escapeHtml(receipt.guestFirstName)}, we have received your stay request. Your check-in date, check-in time, and departure date are listed below. Please keep this code for future correspondence. This receipt does not confirm the reservation until our team completes its review.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${htmlRows}</table>
            <div style="margin-top:26px;padding:18px;border-radius:12px;background:#f3f0ea;color:#4b463e;font-size:13px;line-height:1.7">
              Questions? Contact The Nyakaju at <a href="mailto:info@thenyakaju.com" style="color:#675d4b">info@thenyakaju.com</a> or +256 782 173 076.
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    "THE NYAKAJU — BOOKING REQUEST RECEIPT",
    "",
    `Booking code: ${receipt.confirmationCode}`,
    "Status: Pending administrator review",
    "",
    `Hello ${receipt.guestFirstName}, we have received your stay request. Your check-in date, check-in time, and departure date are listed below. This receipt does not confirm the reservation until our team completes its review.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Questions? Contact info@thenyakaju.com or +256 782 173 076.",
  ].join("\n");

  return { html, text };
}

export async function sendBookingReceipt(receipt: BookingReceipt): Promise<ReceiptDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.BOOKING_EMAIL_FROM?.trim();
  const replyTo = process.env.BOOKING_EMAIL_REPLY_TO?.trim() || DEFAULT_REPLY_TO;

  if (!apiKey || !from) {
    return {
      status: "not_configured",
      providerMessageId: null,
      error: null,
    };
  }

  try {
    const { html, text } = renderBookingReceipt(receipt);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `booking-receipt/${receipt.confirmationCode}`,
      },
      body: JSON.stringify({
        from,
        to: [receipt.guestEmail],
        subject: `Booking request ${receipt.confirmationCode} received`,
        html,
        text,
        reply_to: replyTo,
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

    return {
      status: "sent",
      providerMessageId: payload.id,
      error: null,
    };
  } catch (error) {
    return {
      status: "failed",
      providerMessageId: null,
      error: (error instanceof Error ? error.message : "Email delivery failed.").slice(0, 1_000),
    };
  }
}
