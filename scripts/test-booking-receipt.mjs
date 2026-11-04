import assert from "node:assert/strict";
import {
  renderBookingConfirmation,
  renderBookingReceipt,
  sendBookingConfirmation,
  sendBookingReceipt,
} from "../src/lib/booking-receipt.ts";

delete process.env.RESEND_API_KEY;
delete process.env.BOOKING_EMAIL_FROM;

const receipt = {
  bookingId: 42,
  confirmationCode: "NYK-TEST123",
  status: "pending",
  bookedAt: "2026-11-04T09:30:00+03:00",
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
assert.match(rendered.text, /Booking submitted: November 4, 2026 at 9:30 AM/);
assert.match(rendered.text, /Check-in date: November 10, 2026/);
assert.match(rendered.text, /Check-in time: 2:00 PM East Africa Time/);
assert.match(rendered.text, /Departure date: November 13, 2026/);
assert.match(rendered.html, /<title>Booking request NYK-TEST123 received<\/title>/);

const delivery = await sendBookingReceipt(receipt);
assert.equal(delivery.status, "not_configured");
assert.equal(delivery.providerMessageId, null);
assert.equal(delivery.error, null);

process.env.RESEND_API_KEY = "test-key";
process.env.BOOKING_EMAIL_FROM = "The Nyakaju <info@thenyakaju.com>";
delete process.env.BOOKING_EMAIL_REPLY_TO;

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
assert.equal(requestBody.from, "The Nyakaju <info@thenyakaju.com>");
assert.deepEqual(requestBody.to, ["amina@example.com"]);
assert.equal(requestBody.reply_to, "info@thenyakaju.com");
assert.match(requestBody.text, /Check-in time: 2:00 PM East Africa Time/);

globalThis.fetch = async () => Response.json({ id: "email_123" });
const sentDelivery = await sendBookingReceipt(receipt);
assert.equal(sentDelivery.status, "sent");
assert.equal(sentDelivery.providerMessageId, "email_123");
assert.equal(sentDelivery.error, null);

const confirmation = renderBookingConfirmation({ ...receipt, status: "confirmed" });
assert.match(confirmation.html, /Your booking is confirmed/);
assert.match(confirmation.html, /<title>Booking NYK-TEST123 confirmed<\/title>/);
assert.match(confirmation.text, /Status: Confirmed/);

capturedRequest = undefined;
globalThis.fetch = async (url, init) => {
  capturedRequest = { url, init };
  return Response.json({ id: "email_confirmation_123" });
};
const confirmationDelivery = await sendBookingConfirmation({ ...receipt, status: "confirmed" });
assert.equal(confirmationDelivery.status, "sent");
assert.equal(confirmationDelivery.providerMessageId, "email_confirmation_123");
assert.equal(capturedRequest.init.headers["Idempotency-Key"], "booking-confirmation/NYK-TEST123");
const confirmationRequest = JSON.parse(capturedRequest.init.body);
assert.equal(confirmationRequest.from, "The Nyakaju <info@thenyakaju.com>");
assert.equal(confirmationRequest.subject, "Booking NYK-TEST123 confirmed");
assert.deepEqual(confirmationRequest.to, ["amina@example.com"]);

console.log("Booking receipt and final confirmation rendering and delivery tests passed.");
