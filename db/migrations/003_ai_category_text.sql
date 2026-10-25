-- "Ask your data": expose the category as text, so the AI's ILIKE filters work.
BEGIN;
DROP VIEW ai.expenses;
CREATE VIEW ai.expenses WITH (security_barrier) AS
SELECT e.id, e.paid_by, u.name AS payer_name, e.amount, e.description,
       e.category::text AS category, e.expense_date
FROM expenses e JOIN users u ON u.id = e.paid_by
WHERE e.group_id = current_setting('app.group_id')::int;
GRANT SELECT ON ai.expenses TO fairshare_ai;
COMMIT;
