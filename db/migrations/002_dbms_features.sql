-- FairShare: categories, audit trail, split-total check, settle-up function,
-- reporting view, indexes and a read-only role for the "Ask your data" feature.
-- Run once on a database that already has schema.sql applied.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Expense categories
-- ---------------------------------------------------------------------------
CREATE TYPE expense_category AS ENUM
    ('food', 'rent', 'utilities', 'travel', 'shopping', 'entertainment', 'other');

ALTER TABLE expenses ADD COLUMN category expense_category NOT NULL DEFAULT 'other';

UPDATE expenses SET category = 'food'      WHERE description ILIKE '%grocer%';
UPDATE expenses SET category = 'utilities' WHERE description ILIKE '%internet%';

-- ---------------------------------------------------------------------------
-- 2. Indexes for the queries the app runs most
-- ---------------------------------------------------------------------------
CREATE INDEX idx_expenses_group_date ON expenses (group_id, expense_date DESC);
CREATE INDEX idx_expenses_paid_by    ON expenses (paid_by);
CREATE INDEX idx_splits_user         ON expense_splits (user_id);
CREATE INDEX idx_settlements_group   ON settlements (group_id, settled_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Shares must add up to the expense (checked by the database itself)
--    Deferred, so the expense row and its shares can be inserted one by one
--    inside a transaction and are checked together at COMMIT.
-- ---------------------------------------------------------------------------
CREATE FUNCTION check_split_total() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    eid    int;
    total  numeric;
    shares numeric;
BEGIN
    IF TG_OP = 'DELETE' THEN eid := OLD.expense_id; ELSE eid := NEW.expense_id; END IF;

    SELECT amount INTO total FROM expenses WHERE id = eid;
    IF NOT FOUND THEN
        RETURN NULL;  -- the whole expense was deleted, nothing to check
    END IF;

    SELECT COALESCE(SUM(share_amount), 0) INTO shares FROM expense_splits WHERE expense_id = eid;
    IF shares <> total THEN
        RAISE EXCEPTION 'Shares of expense % add up to % but the expense is %', eid, shares, total
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER split_total_matches
    AFTER INSERT OR UPDATE OR DELETE ON expense_splits
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_split_total();

-- ---------------------------------------------------------------------------
-- 4. Audit trail: every change to groups, members, expenses and payments
--    is written here automatically by a trigger.
--    The API puts the logged-in user's id in the setting app.user_id.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    table_name  TEXT        NOT NULL,
    action      TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    row_id      TEXT,
    group_id    INT,                       -- no FK: the group may be deleted later
    changed_by  INT,
    old_data    JSONB,
    new_data    JSONB,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_group_time ON audit_log (group_id, changed_at DESC);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION audit_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    rec jsonb;
BEGIN
    IF TG_OP = 'DELETE' THEN rec := to_jsonb(OLD); ELSE rec := to_jsonb(NEW); END IF;

    INSERT INTO audit_log (table_name, action, row_id, group_id, changed_by, old_data, new_data)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(rec->>'id', rec->>'user_id'),
        CASE WHEN TG_TABLE_NAME = 'groups' THEN (rec->>'id')::int ELSE (rec->>'group_id')::int END,
        NULLIF(current_setting('app.user_id', true), '')::int,
        CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
    );
    RETURN NULL;
END $$;

CREATE TRIGGER audit_groups        AFTER INSERT OR UPDATE OR DELETE ON groups        FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER audit_group_members AFTER INSERT OR UPDATE OR DELETE ON group_members FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER audit_expenses      AFTER INSERT OR UPDATE OR DELETE ON expenses      FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER audit_settlements   AFTER INSERT OR UPDATE OR DELETE ON settlements   FOR EACH ROW EXECUTE FUNCTION audit_row();

-- ---------------------------------------------------------------------------
-- 5. Settle up: fewest payments that clear the group, computed in the database.
--    The biggest debtor pays the biggest creditor, repeat.
-- ---------------------------------------------------------------------------
CREATE FUNCTION settle_up(p_group_id int)
RETURNS TABLE (from_user int, from_name text, to_user int, to_name text, amount numeric)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    debtors   int[];
    owes      numeric[];
    creditors int[];
    owed      numeric[];
    i int := 1;
    j int := 1;
    pay numeric;
BEGIN
    SELECT array_agg(b.user_id ORDER BY b.balance), array_agg(-b.balance ORDER BY b.balance)
      INTO debtors, owes
      FROM user_balances b WHERE b.group_id = p_group_id AND b.balance < 0;

    SELECT array_agg(b.user_id ORDER BY b.balance DESC), array_agg(b.balance ORDER BY b.balance DESC)
      INTO creditors, owed
      FROM user_balances b WHERE b.group_id = p_group_id AND b.balance > 0;

    WHILE i <= COALESCE(array_length(debtors, 1), 0)
      AND j <= COALESCE(array_length(creditors, 1), 0) LOOP
        pay := LEAST(owes[i], owed[j]);

        from_user := debtors[i];
        to_user   := creditors[j];
        amount    := pay;
        SELECT u.name INTO from_name FROM users u WHERE u.id = debtors[i];
        SELECT u.name INTO to_name   FROM users u WHERE u.id = creditors[j];
        RETURN NEXT;

        owes[i] := owes[i] - pay;
        owed[j] := owed[j] - pay;
        IF owes[i] = 0 THEN i := i + 1; END IF;
        IF owed[j] = 0 THEN j := j + 1; END IF;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Reporting: monthly spending per person per category.
--    A materialized view (stored result) in its own schema, which Supabase's
--    public REST API does not expose. Refreshed by the API when reports load.
-- ---------------------------------------------------------------------------
CREATE SCHEMA reports;

CREATE MATERIALIZED VIEW reports.monthly_spending AS
SELECT e.group_id,
       s.user_id,
       date_trunc('month', e.expense_date)::date AS month,
       e.category,
       SUM(s.share_amount) AS spent,
       COUNT(*)            AS expense_count
FROM expense_splits s
JOIN expenses e ON e.id = s.expense_id
GROUP BY e.group_id, s.user_id, date_trunc('month', e.expense_date), e.category;

CREATE UNIQUE INDEX ON reports.monthly_spending (group_id, user_id, month, category);

-- ---------------------------------------------------------------------------
-- 7. "Ask your data": the AI's SQL runs as this read-only role.
--    It can only read four views, each limited to one group through the
--    setting app.group_id that the API sets before running the query.
-- ---------------------------------------------------------------------------
CREATE ROLE fairshare_ai NOLOGIN;
GRANT fairshare_ai TO postgres;

CREATE SCHEMA ai;

CREATE VIEW ai.members WITH (security_barrier) AS
SELECT u.id AS user_id, u.name
FROM group_members gm JOIN users u ON u.id = gm.user_id
WHERE gm.group_id = current_setting('app.group_id')::int;

CREATE VIEW ai.expenses WITH (security_barrier) AS
SELECT e.id, e.paid_by, u.name AS payer_name, e.amount, e.description, e.category, e.expense_date
FROM expenses e JOIN users u ON u.id = e.paid_by
WHERE e.group_id = current_setting('app.group_id')::int;

CREATE VIEW ai.shares WITH (security_barrier) AS
SELECT s.expense_id, s.user_id, u.name AS person_name, s.share_amount
FROM expense_splits s
JOIN expenses e ON e.id = s.expense_id
JOIN users u ON u.id = s.user_id
WHERE e.group_id = current_setting('app.group_id')::int;

CREATE VIEW ai.payments WITH (security_barrier) AS
SELECT st.id, st.from_user, f.name AS from_name, st.to_user, t.name AS to_name,
       st.amount, st.settled_at::date AS paid_on
FROM settlements st
JOIN users f ON f.id = st.from_user
JOIN users t ON t.id = st.to_user
WHERE st.group_id = current_setting('app.group_id')::int;

REVOKE ALL ON SCHEMA ai FROM PUBLIC;
GRANT USAGE ON SCHEMA ai TO fairshare_ai;
GRANT SELECT ON ai.members, ai.expenses, ai.shares, ai.payments TO fairshare_ai;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM fairshare_ai;

COMMIT;
