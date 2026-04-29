-- PDP-08/09/10: buyer interaction trust layer + dispute linkage

DO $$ BEGIN
    CREATE TYPE interaction_context AS ENUM ('ORDER', 'OFFER', 'CHAT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE buyer_behavior_tag AS ENUM (
        'EXTREME_LOWBALL',
        'NO_FOLLOW_UP',
        'GHOSTING',
        'RUDE_COMMUNICATION',
        'TIMELY_AND_COMMUNICATIVE',
        'FAIR_NEGOTIATOR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE buyer_reputation_band AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dispute_subject AS ENUM ('ORDER', 'BUYER_RATING', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS buyer_interaction_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buyer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context_type interaction_context NOT NULL,
    context_id uuid NOT NULL,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    tags buyer_behavior_tag[] NOT NULL DEFAULT '{}',
    note text,
    is_disputed boolean NOT NULL DEFAULT false,
    is_invalidated boolean NOT NULL DEFAULT false,
    edited_until timestamp NOT NULL DEFAULT now(),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT idx_bir_unique_interaction UNIQUE (seller_id, buyer_id, context_type, context_id)
);

CREATE INDEX IF NOT EXISTS idx_bir_buyer ON buyer_interaction_ratings (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bir_seller ON buyer_interaction_ratings (seller_id);
CREATE INDEX IF NOT EXISTS idx_bir_context ON buyer_interaction_ratings (context_type, context_id);

CREATE TABLE IF NOT EXISTS buyer_reputation_summary (
    buyer_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    score numeric(5, 2) NOT NULL DEFAULT 0,
    band buyer_reputation_band NOT NULL DEFAULT 'MEDIUM',
    sample_size integer NOT NULL DEFAULT 0,
    avg_rating numeric(3, 2) NOT NULL DEFAULT 0,
    completed_orders integer NOT NULL DEFAULT 0,
    lowball_count integer NOT NULL DEFAULT 0,
    no_follow_up_count integer NOT NULL DEFAULT 0,
    ghosting_count integer NOT NULL DEFAULT 0,
    fair_negotiator_count integer NOT NULL DEFAULT 0,
    computed_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_rep_band ON buyer_reputation_summary (band);
CREATE INDEX IF NOT EXISTS idx_buyer_rep_computed ON buyer_reputation_summary (computed_at);

CREATE TABLE IF NOT EXISTS buyer_reputation_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visibility text NOT NULL,
    reason text,
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bra_buyer_created ON buyer_reputation_access_log (buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bra_viewer_created ON buyer_reputation_access_log (viewer_id, created_at);

ALTER TABLE disputes
    ADD COLUMN IF NOT EXISTS dispute_subject dispute_subject NOT NULL DEFAULT 'ORDER';

ALTER TABLE disputes
    ADD COLUMN IF NOT EXISTS target_rating_id uuid REFERENCES buyer_interaction_ratings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_disputes_target_rating_id ON disputes (target_rating_id);
