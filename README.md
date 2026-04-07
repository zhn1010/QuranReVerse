This is a [Next.js](https://nextjs.org) project configured with [`pnpm`](https://pnpm.io/) and [`@quranjs/api`](https://www.npmjs.com/package/@quranjs/api).

## Getting Started

The app expects these variables in `.env`:

```bash
QURAN_CLIENT_ID=...
QURAN_CLIENT_SECRET=...
QURAN_ENDPOINT=https://oauth2.quran.foundation
```

Then run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The home page is a server component that creates a `QuranClient`, applies
`Language.ENGLISH`, and renders the result of:

```ts
const chapters = await client.chapters.findAll();
```
