-- Section 5's "UNIT (IF DIFFERENT)" field is the company the training will
-- be performed with, not the armory location -- duty_location (added
-- earlier) covers the armory's address/city/state, this is separate. Plain
-- text rather than an enum since the picker also allows a free-typed value.
alter table suta_requests
  add column duty_unit text;
