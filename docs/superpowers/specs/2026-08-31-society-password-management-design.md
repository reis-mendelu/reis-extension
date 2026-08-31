# Society password management — design

**Date:** 2026-08-31
**Status:** approved, pending implementation plan

## Problem

Setting or resetting a society's password is currently impossible without
direct database access, and the accounts cannot recover themselves.

Three things are wrong at once:

1. **Authorization is keyed on an email string.** `get_my_role()` and five RLS
   policies all resolve permissions with `WHERE email = (auth.jwt() ->> 'email')`.
   `public.spolky_accounts` has **no foreign key to `auth.users`** — its `id` is a
   standalone PK that does not equal the auth uid. Nothing binds a login to a
   society except a text match.
2. **Six of the seven mailboxes do not exist.** `admin@af-mendelu.cz`,
   `admin@esn.cz`, `admin@zf-mendelu.cz`, `admin@ldf-mendelu.cz`,
   `admin@au-frrms.cz` and `admin@supef.cz` were invented. Only
   `reis.mendelu@gmail.com` (the `reis_admin` account) is real. Email recovery is
   therefore structurally impossible for six accounts.
3. **The admin UI for it is broken.** The retiring console's `/accounts` screen
   calls `auth.signUp()`, which cannot succeed while self-signup is disabled; it
   writes the auth user and the `spolky_accounts` row as two independent
   operations that can diverge; and it has no reset control at all.

Several of those invented addresses sit on real domains owned by third parties.
Self-signup being **off** is the only thing preventing someone from registering
`admin@esn.cz` and inheriting that society's write permissions, because the row
already exists with `is_active = true`. Authorization should not rest on one
dashboard toggle.

## Goals

- A reIS admin can reset **any** society's password from inside the extension.
- A logged-in society can change **its own** password from inside the extension.
- Societies log in with a plain name (`supef`), not an email address.
- Authorization stops depending on email strings.

## Non-goals

- Per-person accounts within a society. One shared login per society
  (decided 2026-08-31); posts are attributed to the society, not a person.
- Email-based password recovery. Deliberately abandoned — the addresses are
  synthetic by design and no mail will ever be deliverable.
- Migrating the six existing society accounts. They are unused; they get deleted
  and re-created through the new UI.

## Verified constraints

Checked against project `zvbpgkmnrqyprtkyxkwn` on 2026-08-31:

- Supabase Auth has **no native username credential**. Every "username" in the
  documentation is a `profiles.username` display field. Credentials are email,
  phone, OAuth, SSO, anonymous, Web3 — nothing else.
- **Secure password change: OFF** → "a user can change their password at any
  time". Society self-service needs no re-authentication and no email OTP. This
  is what makes goal 2 shippable without privileged infrastructure.
- **Require current password when updating: OFF** → `updateUser()` does not ask
  for the old password.
- **Allow new users to sign up: OFF**, **Confirm email: OFF**. Admin-created
  users need no working mailbox.
- `auth.admin.updateUserById(uid, { password })` applies "directly without
  confirmation flows"; `createUser({ email, password, email_confirm: true })` and
  `deleteUser(uid)` complete the admin surface. All require `service_role`.

## Design

### Identity

Username **is** `association_id` — `supef`, `esn`, `reis`. No new column, one
source of truth. Renaming a society changes its login, which is acceptable and
rare.

`src/services/admin/societyLogin.ts` replaces `normalizeEmail` with:

```ts
toAuthEmail(username: string): string  // "supef" -> "supef@societies.invalid"
```

This is the **only** place a login address is ever constructed. `.invalid` is
reserved by RFC 2606 and can never route mail, so the address is honest about
being unreachable rather than impersonating a real domain. Societies never see
it.

**Break-glass exception.** `toAuthEmail` passes through any input already
containing `@` unchanged. The `reis_admin` account deliberately keeps its real
mailbox (`reis.mendelu@gmail.com`) and can sign in with either `reis` or the full
address. Every other account is unreachable by mail on purpose, but the most
privileged one must retain a recovery path that does not depend on the feature
being built here — otherwise a lockout of `reis_admin` is unrecoverable, since it
is the only role permitted to reset anyone. This is the one account where email
recovery stays a deliberate capability rather than an oversight.

### Authorization re-key

Migration in `supabase/migrations/`:

1. `alter table public.spolky_accounts add column user_id uuid references auth.users (id) on delete cascade`
2. Backfill by matching current emails, case- and whitespace-insensitively.
3. Abort the migration if any row fails to pair — better than leaving an account
   that can never authorize.
4. `set not null`, `unique (user_id)`.
5. `get_my_role()` and a new `get_my_association()` resolve by `auth.uid()`, both
   `security definer` with `set search_path = public`.
6. Rewrite the five email-keyed policies against `auth.uid()`. Drop
   `"Users read own account"` — `auth_read_spolky_accounts` is a strict superset.

`resolveAccount()` in `src/store/slices/createAdminSlice.ts` switches from
`.eq('email', email)` to the session user's id. `auth_insert_spolky_accounts` and
`auth_update_spolky_accounts` already route through `get_my_role()` and need no
edit — they start resolving by uid for free.

After this step, holding an email string grants nothing.

### Edge Function

`supabase/functions/society-accounts/`, alongside the six existing functions.
reis-admin is being retired; everything lives in reis-extension.

Verifies the caller's JWT resolves to `reis_admin` **server-side** before any
action. Actions:

- `create` — generate password, `auth.admin.createUser({ email: toAuthEmail(u), password, email_confirm: true })`
  **and** insert the `spolky_accounts` row with `user_id`, in one call, so the two
  can never diverge the way the current code allows
- `reset` — generate password, `auth.admin.updateUserById(uid, { password })`
- `deactivate` — flip `is_active`
- `delete` — `auth.admin.deleteUser(uid)`; the FK cascade removes the row

The generated password is returned **once** in the response body and stored
nowhere. `service_role` is read from the function environment and never reaches
the client bundle.

### UI

In `src/components/AdminConsole/`, one password surface:

- **Any logged-in society:** "Change my password" — `auth.updateUser({ password })`
  with their own session. No Edge Function involved. The society types its own
  value; it is their secret.
- **reIS admin, additionally:** per-society "Reset…" → confirm → a panel showing
  the generated password once, with a copy button and a plain statement that it
  will not be shown again. Admins generate rather than invent, and never learn a
  society's live password.

`SocietyLoginForm.tsx` swaps the email field for username: `type="text"`,
`autocomplete="username"`, new `admin.username` strings in `cs.json` and
`en.json`.

## Bootstrap sequence

The ordering trap: the new UI cannot be used until someone is inside, and `reis`
is the locked-out account.

1. Point Auth **Site URL** at a working origin. The retiring reis-admin console
   at `http://localhost:8080` is sufficient and proven — its Supabase client uses
   the default `detectSessionInUrl`, so a recovery fragment establishes a session
   on arrival. `reismendelu.app` has an empty DNS zone and resolves to nothing,
   which is why the current links die.
2. Recover `reis.mendelu@gmail.com` by email — it is the one real mailbox.
3. Ship this work.
4. Delete and re-create the six societies through the new UI.

## Recommended project-setting changes

- Turn **Require current password when updating: ON** once self-service exists.
  With a shared per-society credential, anyone holding a live session can
  otherwise change the password without knowing the current one and lock the
  society out.
- Leave **Allow new users to sign up: OFF** permanently.

## Testing

Test-first, per the repo's iron rules.

- `toAuthEmail` — mapping, casing, whitespace, rejection of invalid usernames.
- `createAdminSlice.adminLogin` — username in, synthetic address out, account
  resolved by uid.
- Edge Function — a non-admin caller is refused; create is atomic across both
  writes; reset returns the password exactly once.
- RLS — a society reads and writes only its own rows; a reis_admin reaches all;
  an email-only match grants nothing.

Files stay under 200 lines, DaisyUI semantic classes only, direct imports, no
`localStorage`.

## Security properties

- `service_role` exists only in the Edge Function environment.
- Generated passwords are transmitted once and never persisted.
- Authorization derives from `auth.uid()`, not from any user-supplied string.
- Synthetic addresses cannot receive mail, so no recovery path can be hijacked.
  The single exception is the `reis_admin` break-glass mailbox, which is a real
  Gmail account and should carry its own strong protections.
