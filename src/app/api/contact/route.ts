import { errorResponse, readNonEmptyString } from "@/lib/api";
import { sendContactMessage } from "@/lib/contact-message";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Invalid contact form submission.");
    }
    const honeypot = typeof body.website === "string" ? body.website.trim() : "";

    if (honeypot) {
      return Response.json({ message: "Thank you. Your message has been sent." });
    }

    const submissionId = readNonEmptyString(body.submissionId, "Submission ID", 36);
    const name = readNonEmptyString(body.name, "Name", 100);
    const email = readNonEmptyString(body.email, "Email", 320).toLowerCase();
    const message = readNonEmptyString(body.message, "Message", 5_000);

    if (!UUID_PATTERN.test(submissionId)) {
      throw new Error("The contact form session is invalid. Refresh the page and try again.");
    }

    if (!EMAIL_PATTERN.test(email)) {
      throw new Error("Enter a valid email address.");
    }

    const delivery = await sendContactMessage({ submissionId, name, email, message });
    if (delivery.status !== "sent") {
      console.error("Contact message delivery failed", {
        status: delivery.status,
        error: delivery.error,
      });
      return Response.json(
        { error: "Your message could not be sent right now. Please try again shortly." },
        { status: delivery.status === "not_configured" ? 503 : 502 },
      );
    }

    return Response.json({ message: "Thank you. Your message has been sent." }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Invalid contact form submission.");
  }
}
