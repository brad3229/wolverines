-- Some Soldiers draw VA disability pay and elect not to receive drill pay (to avoid having
-- to pay it back later). Track that as a flag on the roster so full-time staff can see it
-- at a glance instead of digging through pay issue reports.
alter table soldiers add column receives_drill_pay boolean not null default true;
