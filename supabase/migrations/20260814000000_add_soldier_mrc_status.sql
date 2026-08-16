-- Medical Readiness Classification: 1-4, with 3/4 meaning the soldier is
-- not medically ready and needs to be flagged for follow-up.
alter table soldiers
  add column mrc_status text check (mrc_status in ('1', '2', '3', '4'));
