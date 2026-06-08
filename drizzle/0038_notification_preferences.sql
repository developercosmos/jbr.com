-- Granular, per-user notification preferences.
--
-- Replaces the single `email_promo_opt_in` flag with a per-category structure
-- covering both channels: { [category]: { email: bool, inApp: bool } }.
-- Categories: orders, chat, offers, reviews, disputes, promotions.
--
-- `notifications.in_app_suppressed` lets the bell honor a user's in-app opt-out
-- while the notification row is STILL written — it remains the idempotency /
-- audit ledger (so cron retries never double-send), it's just hidden from the
-- bell list + unread count.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "in_app_suppressed" boolean DEFAULT false NOT NULL;

-- Back-compat: carry the legacy promo opt-in into the new model so users who
-- previously opted out of marketing email stay opted out. Everything else
-- defaults to ON, which the application layer fills in when reading.
UPDATE "users"
SET "notification_preferences" = jsonb_build_object(
    'promotions', jsonb_build_object('email', "email_promo_opt_in", 'inApp', true)
)
WHERE "notification_preferences" = '{}'::jsonb;

-- Bell queries filter (user_id, read, in_app_suppressed); index to match.
CREATE INDEX IF NOT EXISTS "idx_notifications_user_visible"
    ON "notifications" ("user_id", "read", "in_app_suppressed");
