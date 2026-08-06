-- Section 4 of NC ARNG Form 350-2R has separate START and END duty dates --
-- the app only ever asked for and filled in one date for both. This adds an
-- optional end date; requested_makeup_date becomes the start of the range.
alter table suta_requests
  add column requested_makeup_end_date date;
