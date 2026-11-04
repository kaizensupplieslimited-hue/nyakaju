This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Administrator sign-in

The administrator login uses the username `admin` and a Supabase Auth password for
`daniellochole@gmail.com`. Configure or replace that password without committing it:

```powershell
$env:NYAKAJU_ADMIN_PASSWORD = "choose-a-strong-password"
npm run setup:admin
Remove-Item Env:NYAKAJU_ADMIN_PASSWORD
```

The setup command also assigns the protected `admin` role in Supabase app metadata.

## Booking receipt email

Booking requests are saved even when email delivery is not configured or the provider is temporarily unavailable. The guest receives a request receipt after submission and a separate final confirmation when an administrator confirms the booking. To enable both messages, add these server-only environment variables locally and in the deployment environment:

```dotenv
RESEND_API_KEY=re_...
BOOKING_EMAIL_FROM=The Nyakaju <info@thenyakaju.com>
BOOKING_EMAIL_REPLY_TO=info@thenyakaju.com
BOOKING_CHECK_IN_TIME=2:00 PM East Africa Time
CONTACT_EMAIL_FROM=The Nyakaju Website <website@thenyakaju.com>
```

`BOOKING_EMAIL_REPLY_TO`, `BOOKING_CHECK_IN_TIME`, and `CONTACT_EMAIL_FROM` are optional. Replies default to `info@thenyakaju.com`, check-in defaults to `2:00 PM East Africa Time`, and contact messages fall back to `BOOKING_EMAIL_FROM`. Sender addresses must use the verified Resend domain. Booking receipts go to the guest; contact-form messages always go to `info@thenyakaju.com`.

Apply the latest Supabase migration before deploying the application changes:

```bash
npx supabase db push
```

If a booking was created before the sender was configured, an authenticated administrator can open that booking in **Admin → Bookings** and choose **Send receipt**. Failed deliveries can be retried from the same panel.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
