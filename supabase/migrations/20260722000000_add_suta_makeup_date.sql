-- Soldiers submitting a SUTA request often already know which future drill they'll use
-- to make up the missed one -- let them propose that date up front instead of leaving the
-- admin to track it down after the fact once make-up tracking starts. Nullable since a
-- Soldier frequently doesn't know yet when they submit the request.
alter table suta_requests
  add column requested_makeup_date date;
