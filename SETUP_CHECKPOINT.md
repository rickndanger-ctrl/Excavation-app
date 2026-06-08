# Setup Checkpoint — Supabase Integration

Recorded: Jun 7, 2026

## Status: Working ✅

Supabase mode is confirmed working. The app loads seeded project data from Supabase and displays a green **● Supabase** badge in the project bar.

---

## Requirements

### 1. Environment file (`.env`)

A `.env` file is required in the project root. It is **not committed to git** (listed in `.gitignore`).

```
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_<your-key>
```

- Use the **Publishable** key from Supabase Dashboard → Settings → API.
- Never commit `.env` or share the key publicly.
- See `.env.example` for the correct variable names.

### 2. Schema

Run `supabase-schema.sql` first in the Supabase SQL Editor.

Creates tables: `projects`, `plan_sheets`
Enables RLS with public read / authenticated write policies.
Creates storage bucket: `plan-sheets`.

### 3. Seed data

Run `supabase-seed.sql` after the schema.

Inserts: "Cedar Grove Apartments — Site Civil" sample project with phases, layers, blueprint objects, and utility lines.

---

## Running the app

```bash
npm run dev
```

Then open `http://localhost:5173` in the browser.

---

## Confirming Supabase is active

- Project selector shows **Cedar Grove Apartments — Site Civil**
- Status badge shows **● Supabase** in green
- Browser console shows `[Supabase probe] HTTP 200`

If the badge shows **● Local only**, the `.env` file is missing or the dev server needs a restart.  
If the badge shows **● Supabase error** (red), hover it for the error message and check the browser console.

---

## What not to do

- Do not commit `.env`
- Do not share the publishable key
- Do not run the seed before the schema
- After any `.env` change, restart the dev server (`Ctrl+C` then `npm run dev`)
