# BotFlow security runbook

## Secret rotation

Rotate the two Telegram bot tokens in BotFather, the AI provider key, and both
Lava credentials in their provider dashboards. Do not paste replacement values
into chat, source code, Git history, screenshots, or tickets. Store them only in
the production secret manager/environment, then revoke the old values.

## Local development

Development listens on `127.0.0.1` and ignores production services by default.
Create a separate Supabase project and test Telegram bot, then populate only the
`DEV_*` and `VITE_DEV_*` variables documented in `.env.example`.

`ALLOW_DEV_AUTH_BYPASS=true` and `VITE_ALLOW_DEV_AUTH_BYPASS=true` are explicit
emergency switches. Keep both unset during normal work. Never combine them with
`ALLOW_NETWORK_BIND=true`.

## MFA

The admin interface enrolls or challenges a TOTP factor immediately after the
password login. The server rejects protected API calls unless the Supabase JWT
has `aal2`. Keep `REQUIRE_ADMIN_MFA=true`.

## Encrypted backups

Install PostgreSQL client tools, provide a direct `SUPABASE_DB_URL`, and point
`BACKUP_OUTPUT_DIR` at an external encrypted/synced volume. Then run:

```bash
npm run backup:encrypted
```

The command exports both PostgreSQL and all Storage buckets, encrypts the
archive with AES-256/PBKDF2, writes a SHA-256 checksum, and deletes the
unencrypted temporary copy. Test restore quarterly in the separate development
project. Keep the encryption password outside the backup destination.
