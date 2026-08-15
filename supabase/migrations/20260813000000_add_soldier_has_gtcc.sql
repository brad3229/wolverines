-- Tracks whether a soldier has a Government Travel Charge Card, the same
-- simple yes/no shape as receives_drill_pay.
alter table soldiers
  add column has_gtcc boolean not null default false;
