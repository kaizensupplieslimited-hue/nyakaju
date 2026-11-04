import assert from "node:assert/strict";
import {
  renderContactMessage,
  sendContactMessage,
} from "../src/lib/contact-message.ts";

delete process.env.RESEND_API_KEY;
delete process.env.CONTACT_EMAIL_FROM;
delete process.env.BOOKING_EMAIL_FROM;

const contact = {
  submissionId: "b933cd3d-9b30-4d4a-bd1e-2bbd52d8ca2b",
  name: "Amina <Guest>",
  email: "amina@example.com",
  message: "Hello <script>alert('no')</script>\nI would like more information.",
};

const rendered = renderContactMessage(contact);
assert.match(rendered.html, /Amina &lt;Guest&gt;/);
assert.doesNotMatch(rendered.html, /<script>/);
assert.match(rendered.html, /<br>/);
assert.match(rendered.text, /amina@example\.com/);

const notConfigured = await sendContactMessage(contact);
assert.equal(notConfigured.status, "not_configured");

process.env.RESEND_API_KEY = "test-key";
process.env.CONTACT_EMAIL_FROM = "The Nyakaju Website <website@thenyakaju.com>";
process.env.BOOKING_EMAIL_FROM = "The Nyakaju <bookings@thenyakaju.com>";

let capturedRequest;
globalThis.fetch = async (url, init) => {
  capturedRequest = { url, init };
  return Response.json({ id: "email_contact_123" });
};

const sent = await sendContactMessage(contact);
assert.equal(sent.status, "sent");
assert.equal(sent.providerMessageId, "email_contact_123");
assert.equal(capturedRequest.url, "https://api.resend.com/emails");
assert.equal(capturedRequest.init.headers["Idempotency-Key"], `contact-message/${contact.submissionId}`);

const requestBody = JSON.parse(capturedRequest.init.body);
assert.equal(requestBody.from, "The Nyakaju Website <website@thenyakaju.com>");
assert.deepEqual(requestBody.to, ["info@thenyakaju.com"]);
assert.equal(requestBody.reply_to, "amina@example.com");
assert.equal(requestBody.subject, "New website contact message");
assert.deepEqual(requestBody.tags, [{ name: "source", value: "contact-form" }]);

globalThis.fetch = async () => Response.json({ message: "Provider rejected request" }, { status: 422 });
const failed = await sendContactMessage(contact);
assert.equal(failed.status, "failed");
assert.match(failed.error, /Provider rejected request/);

console.log("Contact message rendering, recipient, reply-to, idempotency, and delivery tests passed.");
