import assert from "node:assert/strict";
import {
  renderBookingReceipt,
  sendBookingReceipt,
} from "../src/lib/booking-receipt.ts";

delete process.env.RESEND_API_KEY;
delete process.env.BOOKING_EMAIL_FROM;

const receipt = {
  bookingId: 42,
  confirmationCode: "NYK-TEST123",
  status: "pending",
  guestFirstName: "Amina",
  guestLastName: "N.",
  guestEmail: "amina@example.com",
  guestPhone: "+256700000000",
  roomName: "Deluxe Room",
  roomCount: 2,
  adults: 2,
  children: 1,
  arrival: "2026-11-10",
  departure: "2026-11-13",
  nightlyRate: 100,
  totalAmount: 600,
  currency: "USD",
};

const rendered = renderBookingReceipt(receipt);
assert.match(rendered.html, /amina@example\.com/);
assert.match(rendered.text, /NYK-TEST123/);
assert.match(rendered.text, /3 nights/);
assert.match(rendered.text, /\$600/);

const delivery = await sendBookingReceipt(receipt);
assert.equal(delivery.status, "not_configured");
assert.equal(delivery.providerMessageId, null);
assert.equal(delivery.error, null);

process.env.RESEND_API_KEY = "test-key";
process.env.BOOKING_EMAIL_FROM = "The Nyakaju <bookings@example.com>";
process.env.BOOKING_EMAIL_REPLY_TO = "info@example.com";

let capturedRequest;
globalThis.fetch = async (url, init) => {
  capturedRequest = { url, init };
  return Response.json({ message: "Provider unavailable" }, { status: 503 });
};

const failedDelivery = await sendBookingReceipt(receipt);
assert.equal(failedDelivery.status, "failed");
assert.match(failedDelivery.error, /Provider unavailable/);
assert.equal(capturedRequest.url, "https://api.resend.com/emails");
assert.equal(capturedRequest.init.headers["Idempotency-Key"], "booking-receipt/NYK-TEST123");
const requestBody = JSON.parse(capturedRequest.init.body);
assert.deepEqual(requestBody.to, ["amina@example.com"]);
assert.equal(requestBody.reply_to, "info@example.com");

globalThis.fetch = async () => Response.json({ id: "email_123" });
const sentDelivery = await sendBookingReceipt(receipt);
assert.equal(sentDelivery.status, "sent");
assert.equal(sentDelivery.providerMessageId, "email_123");
assert.equal(sentDelivery.error, null);

console.log("Receipt rendering, recipient, idempotency, fallback, failure, and success tests passed.");
