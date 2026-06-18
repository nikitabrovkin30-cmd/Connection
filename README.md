# Connection

Connection is a small association game built with Vite, React, TypeScript, Supabase, and Vercel.

The player sees a target word, writes an association, and the app shows how many players connected the same association with the target word.

## Stack

- Vite + React 18 + TypeScript
- Supabase Auth, database, and Row Level Security
- Vercel deployment

## Local Start

```bash
npm install
npm run dev
```

The app usually opens at `http://localhost:5173`.

## Database

Database changes are stored in `supabase/migrations/`.

Apply migrations with:

```bash
npm run db:push
```

The main game table is `association_guesses`. RLS is enabled, so users can only read and write their own guesses. The public result count is returned through the `count_association` database function.

## Build

```bash
npm run build
```
