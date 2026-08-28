-- Distinguishes which canned DA 4856 script a counseling used (Initial,
-- Late, ...). The actual Purpose/Key Points/Plan of Action/Leader
-- Responsibilities text still lives in their own columns (picking a type in
-- the UI just fills those in) -- this column is for labeling/filtering, not
-- for driving the PDF fill.
alter table counselings
  add column counseling_type text not null default 'initial'
    check (counseling_type in ('initial', 'late'));
