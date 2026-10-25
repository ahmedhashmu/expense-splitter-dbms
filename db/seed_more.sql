-- Extra demo data for reports and "Ask your data" (Flat 4B, August to October).
-- Run after seed.sql and migrations/002_dbms_features.sql.
-- Each expense is split equally between Ali (1), Sara (2) and Bilal (3);
-- any leftover paisa goes to the first person, so shares always add up.

BEGIN;

CREATE FUNCTION pg_temp.add_expense(payer int, amt numeric, descr text, cat expense_category, d date)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    eid  int;
    each numeric := round(amt / 3, 2);
BEGIN
    INSERT INTO expenses (group_id, paid_by, amount, description, category, expense_date)
    VALUES (1, payer, amt, descr, cat, d) RETURNING id INTO eid;
    INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES
        (eid, 1, amt - 2 * each), (eid, 2, each), (eid, 3, each);
END $$;

SELECT set_config('app.user_id', '1', true);

SELECT pg_temp.add_expense(1, 45000, 'August rent',              'rent',          '2026-08-01');
SELECT pg_temp.add_expense(2,  6200, 'Electricity bill',         'utilities',     '2026-08-06');
SELECT pg_temp.add_expense(3,  3400, 'Weekly groceries',         'food',          '2026-08-09');
SELECT pg_temp.add_expense(1,  2700, 'Pizza night',              'food',          '2026-08-17');
SELECT pg_temp.add_expense(2,  1800, 'Cinema tickets',           'entertainment', '2026-08-23');

SELECT pg_temp.add_expense(1, 45000, 'September rent',           'rent',          '2026-09-01');
SELECT pg_temp.add_expense(3,  5900, 'Electricity bill',         'utilities',     '2026-09-05');
SELECT pg_temp.add_expense(2,  4100, 'Weekly groceries',         'food',          '2026-09-11');
SELECT pg_temp.add_expense(3, 12000, 'Murree trip - hotel',      'travel',        '2026-09-19');
SELECT pg_temp.add_expense(1,  4500, 'Murree trip - petrol',     'travel',        '2026-09-19');
SELECT pg_temp.add_expense(2,  2300, 'Murree trip - food',       'food',          '2026-09-20');

SELECT pg_temp.add_expense(1, 45000, 'October rent',             'rent',          '2026-10-01');
SELECT pg_temp.add_expense(3,  5600, 'Electricity bill',         'utilities',     '2026-10-04');
SELECT pg_temp.add_expense(2,  3900, 'Weekly groceries',         'food',          '2026-10-12');
SELECT pg_temp.add_expense(3,  3200, 'Kitchen things',           'shopping',      '2026-10-16');
SELECT pg_temp.add_expense(1,  2100, 'Biryani for guests',       'food',          '2026-10-21');

-- Bilal paid some of what he owes
INSERT INTO settlements (group_id, from_user, to_user, amount, settled_at)
VALUES (1, 3, 1, 15000, '2026-09-25');

COMMIT;
