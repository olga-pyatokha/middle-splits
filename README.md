# Middle Splits Tracker

A phone-first middle-splits training tracker backed by Supabase.

## Planned features
- Email sign-in
- Training plans and workout sessions
- Exercise logs with left/right notes
- Measurements and progress history
- Coach reviews and plan updates

## Supabase
Project URL: `https://cudrwuqlxczbvzbiorhj.supabase.co`

Frontend environment variables (use a local `.env.local`, do not commit secrets):

```env
NEXT_PUBLIC_SUPABASE_URL=https://cudrwuqlxczbvzbiorhj.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

Database tables: `training_plans`, `sessions`, `exercise_logs`, `measurements`, `coach_reviews`. Each table has RLS enabled and authenticated owner policies.
