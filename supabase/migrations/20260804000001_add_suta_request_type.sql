-- Which of the 5 official request types this SUTA request is, matching the
-- radio choices on NC ARNG Form 350-2R -- needed to auto-select the matching
-- choice when generating the pre-filled PDF. Nullable so existing requests
-- (submitted before this field existed) don't need backfilling.
create type suta_request_type as enum (
  'suta_before',
  'suta_after',
  'rma',
  'present_at_alt_location',
  'authorized_absence'
);

alter table suta_requests
  add column request_type suta_request_type;
