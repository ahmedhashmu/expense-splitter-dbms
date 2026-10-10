-- FairShare schema (PostgreSQL)

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone       VARCHAR(20),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE groups (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    created_by  INT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
    group_id    INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE TYPE split_type AS ENUM ('equal', 'exact', 'percentage');

CREATE TABLE expenses (
    id           SERIAL PRIMARY KEY,
    group_id     INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    paid_by      INT NOT NULL REFERENCES users(id),
    amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description  VARCHAR(255) NOT NULL,
    split_type   split_type NOT NULL DEFAULT 'equal',
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expense_splits (
    expense_id    INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id       INT NOT NULL REFERENCES users(id),
    share_amount  NUMERIC(12,2) NOT NULL CHECK (share_amount >= 0),
    PRIMARY KEY (expense_id, user_id)
);

CREATE TABLE settlements (
    id          SERIAL PRIMARY KEY,
    group_id    INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    from_user   INT NOT NULL REFERENCES users(id),
    to_user     INT NOT NULL REFERENCES users(id),
    amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    settled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_user <> to_user)
);

-- Net balance per user per group:
-- paid - own share + received settlements - sent settlements
CREATE VIEW user_balances WITH (security_invoker = true) AS
SELECT
    gm.group_id,
    gm.user_id,
    COALESCE((SELECT SUM(e.amount) FROM expenses e
              WHERE e.group_id = gm.group_id AND e.paid_by = gm.user_id), 0)
  - COALESCE((SELECT SUM(s.share_amount) FROM expense_splits s
              JOIN expenses e ON e.id = s.expense_id
              WHERE e.group_id = gm.group_id AND s.user_id = gm.user_id), 0)
  + COALESCE((SELECT SUM(st.amount) FROM settlements st
              WHERE st.group_id = gm.group_id AND st.from_user = gm.user_id), 0)
  - COALESCE((SELECT SUM(st.amount) FROM settlements st
              WHERE st.group_id = gm.group_id AND st.to_user = gm.user_id), 0)
    AS balance
FROM group_members gm;

-- Supabase exposes tables through its public REST API by default.
-- Our backend connects directly as the postgres role (bypasses RLS),
-- so turning RLS on with no policies blocks that public API completely.
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements    ENABLE ROW LEVEL SECURITY;
