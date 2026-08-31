This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Auth security

Local Supabase Auth and the signup form both require passwords of at least 8 characters.

Leaked-password protection is a hosted Supabase Auth setting and cannot be enabled by a database migration. For each deployed project, set the minimum password length to 8 and enable **Authentication > Providers > Email > Leaked password protection** in the Supabase Dashboard (Pro plan or above), then verify that the `auth_leaked_password_protection` security advisor is cleared. This repository does not claim that either remote setting has been enabled.

## Local E2E

Writable E2E tests are restricted to loopback URLs and create unique users and households for every test. Their teardown uses the local Supabase `service_role` key to remove those fixtures; no shared account or external secret is required.

Docker and the Supabase CLI are required. Start Supabase with `supabase start`, copy `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` from `supabase status -o json` into the corresponding local environment variables, set `E2E_ALLOW_WRITES=true`, then run `npm run test:e2e`. The GitHub workflow performs these steps automatically and passes the same local URL and anonymous key to the Next.js server.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
