import { readPositiveInteger } from "@/lib/api";
import { sendBookingConfirmation } from "@/lib/booking-receipt";
import {
  canManuallyTransitionBookingStatus,
  isBookingStatus,
} from "@/lib/booking-status";
import { requireAdminSession } from "@/lib/supabase/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;
  const id = readPositiveInteger((await params).id, "Booking");
  const body = await request.json();
  const status = typeof body.status === "string" ? body.status.toLowerCase() : "";

  if (!isBookingStatus(status)) {
    return Response.json({ error: "Choose a valid booking status." }, { status: 400 });
  }

  const { data: currentBooking, error: currentBookingError } = await auth.session.supabase
    .from("bookings")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (currentBookingError) {
    console.error("Admin booking lookup failed", currentBookingError);
    return Response.json({ error: "Booking could not be loaded." }, { status: 500 });
  }
  if (!currentBooking) {
    return Response.json({ error: "Booking not found." }, { status: 404 });
  }
  if (!canManuallyTransitionBookingStatus(currentBooking.status, status)) {
    return Response.json(
      { error: `A ${currentBooking.status} booking cannot be changed to ${status}.` },
      { status: 409 },
    );
  }

  const adminNotes = typeof body.adminNotes === "string"
    ? body.adminNotes.trim().slice(0, 2_000) || null
    : undefined;
  const { data, error } = await auth.session.supabase
    .from("bookings")
    .update({
      status,
      ...(adminNotes !== undefined ? { admin_notes: adminNotes } : {}),
    })
    .eq("id", id)
    .eq("status", currentBooking.status)
    .select("*, room_types(name, slug)")
    .maybeSingle();

  if (error) {
    if (error.message.includes("ROOM_SOLD_OUT")) {
      return Response.json(
        { error: "No units are available for this room type across the booking dates." },
        { status: 409 },
      );
    }
    if (error.message.includes("ROOM_NOT_AVAILABLE")) {
      return Response.json(
        { error: "This room type is no longer available." },
        { status: 409 },
      );
    }
    console.error("Admin booking update failed", error);
    return Response.json({ error: "Booking could not be updated." }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { error: "This booking changed while you were editing it. Refresh and try again." },
      { status: 409 },
    );
  }

  if (currentBooking.status === "pending" && status === "confirmed") {
    const room = data.room_types;
    const delivery = await sendBookingConfirmation({
      bookingId: data.id,
      confirmationCode: data.confirmation_code,
      status: data.status,
      bookedAt: data.created_at,
      guestFirstName: data.guest_first_name,
      guestLastName: data.guest_last_name,
      guestEmail: data.guest_email,
      guestPhone: data.guest_phone,
      roomName: room?.name ?? "The Nyakaju room",
      roomCount: data.room_count,
      adults: data.adults_count,
      children: data.children_count,
      arrival: data.arrival_date,
      departure: data.departure_date,
      nightlyRate: Number(data.nightly_rate),
      totalAmount: Number(data.total_amount),
      currency: data.currency,
    });

    const { data: bookingWithDelivery, error: deliveryUpdateError } = await auth.session.supabase
      .from("bookings")
      .update({
        confirmation_email_status: delivery.status,
        confirmation_email_provider_id: delivery.providerMessageId,
        confirmation_email_sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
        confirmation_email_last_error: delivery.error,
      })
      .eq("id", id)
      .select("*, room_types(name, slug)")
      .maybeSingle();

    if (deliveryUpdateError || !bookingWithDelivery) {
      console.error("Booking confirmation delivery status update failed", deliveryUpdateError);
      return Response.json({
        booking: data,
        confirmationEmailDelivery: delivery.status,
        message: "The booking was confirmed, but the email delivery status could not be saved.",
      });
    }

    const message = delivery.status === "sent"
      ? `Booking confirmed and confirmation emailed to ${data.guest_email}.`
      : delivery.status === "not_configured"
        ? "Booking confirmed, but email delivery is not configured."
        : "Booking confirmed, but the confirmation email could not be sent. Retry it from the booking details.";

    return Response.json({
      booking: bookingWithDelivery,
      confirmationEmailDelivery: delivery.status,
      message,
    });
  }

  return Response.json({ booking: data });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.session) return auth.response;
  const id = readPositiveInteger((await params).id, "Booking");
  const body = await request.json().catch(() => ({}));
  const confirmationCode = typeof body.confirmationCode === "string"
    ? body.confirmationCode.trim()
    : "";

  if (!confirmationCode) {
    return Response.json(
      { error: "The booking confirmation code is required for permanent deletion." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.session.supabase
    .from("bookings")
    .delete()
    .eq("id", id)
    .eq("confirmation_code", confirmationCode)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Admin booking delete failed", error);
    return Response.json({ error: "Booking could not be deleted." }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { error: "Booking not found or the confirmation code did not match." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}
