-- Sample data for demos. Run after schema.sql.
-- All three demo users log in with the password: demo1234
INSERT INTO users (name, email, password_hash) VALUES
  ('Ali',  'ali@example.com',  '$2b$12$J03NoghWV46y1GlxOr4XXuDrbymZT/xR4ZhkCYsk7sQaYmyQZSpjy'),
  ('Sara', 'sara@example.com', '$2b$12$J03NoghWV46y1GlxOr4XXuDrbymZT/xR4ZhkCYsk7sQaYmyQZSpjy'),
  ('Bilal','bilal@example.com','$2b$12$J03NoghWV46y1GlxOr4XXuDrbymZT/xR4ZhkCYsk7sQaYmyQZSpjy');

INSERT INTO groups (name, created_by) VALUES ('Flat 4B', 1);
INSERT INTO group_members (group_id, user_id) VALUES (1,1),(1,2),(1,3);

-- Ali pays 900 for groceries, split equally
INSERT INTO expenses (group_id, paid_by, amount, description, split_type)
VALUES (1, 1, 900.00, 'Groceries', 'equal');
INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES
  (1,1,300.00),(1,2,300.00),(1,3,300.00);

-- Sara pays 300 for internet, split equally
INSERT INTO expenses (group_id, paid_by, amount, description, split_type)
VALUES (1, 2, 300.00, 'Internet', 'equal');
INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES
  (2,1,100.00),(2,2,100.00),(2,3,100.00);

-- Expected balances: Ali +500, Sara -100, Bilal -400
-- (Sara paid 300 but her share is 300 + 100 = 400)
