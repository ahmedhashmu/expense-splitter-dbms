-- FairShare: DBMS features to show live in the Supabase SQL editor.
-- Run one block at a time. Nothing here changes the real data:
-- every block that writes ends in ROLLBACK.

-- 1. Settle up is a stored function --------------------------------------
SELECT * FROM settle_up(1);


-- 2. The database itself rejects shares that don't add up ------------------
--    (deferred constraint trigger split_total_matches)
BEGIN;
INSERT INTO expenses (group_id, paid_by, amount, description, category)
VALUES (1, 1, 900, 'Bad split', 'food') RETURNING id;
-- use the id returned above:
INSERT INTO expense_splits (expense_id, user_id, share_amount)
SELECT max(id), 1, 100 FROM expenses;          -- only 100 of 900
SET CONSTRAINTS ALL IMMEDIATE;                  -- check now instead of at COMMIT
-- ERROR: Shares of expense ... add up to 100.00 but the expense is 900.00
ROLLBACK;


-- 3. Atomicity: a failed transaction leaves nothing behind -----------------
BEGIN;
INSERT INTO expenses (group_id, paid_by, amount, description, category)
VALUES (1, 1, 300, 'Half-written expense', 'food');
SELECT count(*) AS visible_inside_the_transaction FROM expenses WHERE description = 'Half-written expense';
ROLLBACK;
SELECT count(*) AS left_after_rollback FROM expenses WHERE description = 'Half-written expense';  -- 0


-- 4. Audit trail written by triggers ---------------------------------------
SELECT action, table_name, changed_at, new_data->>'description' AS what
FROM audit_log ORDER BY id DESC LIMIT 10;


-- 5. Window functions on the materialized view -----------------------------
REFRESH MATERIALIZED VIEW reports.monthly_spending;
SELECT month, user_id, SUM(spent) AS spent,
       SUM(SUM(spent)) OVER (PARTITION BY user_id ORDER BY month) AS running_total
FROM reports.monthly_spending
WHERE group_id = 1
GROUP BY month, user_id
ORDER BY month, user_id;


-- 6. What an index changes (EXPLAIN ANALYZE before and after) --------------
--    Uses a throwaway copy with 200,000 rows so the difference is visible.
BEGIN;
CREATE TEMP TABLE big_expenses AS
SELECT g AS id, (g % 500) + 1 AS group_id, (random() * 5000)::numeric(12,2) AS amount,
       DATE '2026-01-01' + (g % 300) AS expense_date
FROM generate_series(1, 200000) g;
ANALYZE big_expenses;

-- before: Seq Scan over all 200,000 rows
EXPLAIN ANALYZE SELECT SUM(amount) FROM big_expenses WHERE group_id = 42;

CREATE INDEX ON big_expenses (group_id);
ANALYZE big_expenses;

-- after: Bitmap/Index Scan, reads only the ~400 matching rows
EXPLAIN ANALYZE SELECT SUM(amount) FROM big_expenses WHERE group_id = 42;
ROLLBACK;


-- 7. The AI's database role can only read its views ------------------------
BEGIN;
SELECT set_config('app.group_id', '1', true);
SET LOCAL ROLE fairshare_ai;
SELECT payer_name, amount, category FROM ai.expenses LIMIT 5;   -- works
SELECT * FROM users;                                             -- ERROR: permission denied
ROLLBACK;
