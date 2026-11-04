import { readPositiveInteger } from "@/lib/api";
import { sendBookingReceipt } from "@/lib/booking-receipt";
import { requireAdminSession } from "@/lib/supabase/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;

  const id = readPositiveInteger((await params).id, "Booking");
  const { data: booking, error: bookingError } = await auth.session.supabase
    .from("bookings")
    .select("*, room_types(name, slug)")
    .eq("id", id)
    .maybeSingle();

  if (bookingError) {
    console.error("Admin receipt booking lookup failed", bookingError);
    return Response.json({ error: "Booking could not be loaded." }, { status: 500 });
  }
  if (!booking) {
    return Response.json({ error: "Booking not found." }, { status: 404 });
  }
  if (booking.receipt_email_status === "sent") {
    return Response.json(
      { error: "This booking receipt has already been sent." },
      { status: 409 },
    );
  }

  const room = booking.room_types;
  const delivery = await sendBookingReceipt({
    bookingId: booking.id,
    confirmationCode: booking.confirmation_code,
    status: booking.status,
    bookedAt: booking.created_at,
    guestFirstName: booking.guest_first_name,
    guestLastName: booking.guest_last_name,
    guestEmail: booking.guest_email,
    guestPhone: booking.guest_phone,
    roomName: room?.name ?? "The Nyakaju room",
    roomCount: booking.room_count,
    adults: booking.adults_count,
    children: booking.children_count,
    arrival: booking.arrival_date,
    departure: booking.departure_date,
    nightlyRate: Number(booking.nightly_rate),
    totalAmount: Number(booking.total_amount),
    currency: booking.currency,
  });

  const { data: updatedBooking, error: updateError } = await auth.session.supabase
    .from("bookings")
    .update({
      receipt_email_status: delivery.status,
      receipt_email_provider_id: delivery.providerMessageId,
      receipt_email_sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
      receipt_email_last_error: delivery.error,
    })
    .eq("id", id)
    .select("*, room_types(name, slug)")
    .maybeSingle();

  if (updateError || !updatedBooking) {
    console.error("Admin receipt delivery status update failed", updateError);
    return Response.json(
      { error: "The receipt attempt completed, but its status could not be saved." },
      { status: 500 },
    );
  }

  const message = delivery.status === "sent"
    ? `Receipt sent to ${booking.guest_email}.`
    : delivery.status === "not_configured"
      ? "Configure RESEND_API_KEY and BOOKING_EMAIL_FROM before sending receipts."
      : "The receipt could not be sent. Review the recorded delivery error and try again.";

  return Response.json({
    booking: updatedBooking,
    receiptDelivery: delivery.status,
    message,
  });
}
