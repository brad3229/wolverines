-- Records that the Soldier explicitly acknowledged Section 8's Statement of
-- Understanding at submission time (via an in-app confirmation popup, since
-- there's no way to collect a physical initial next to each line) -- the PDF
-- fill only writes the Soldier's initials into INI1-INI11 when this is set,
-- so requests submitted before this feature existed still render blank.
alter table suta_requests
  add column acknowledged_at timestamptz;

-- Where the make-up/alternate-location duty will be performed, if applicable
-- -- maps onto the SUTA certificate's "LOCATION DUTY TO BE PERFORMED" fields.
create type suta_duty_location as enum (
  'jacksonville',
  'wilmington',
  'lumberton',
  'fayetteville'
);

alter table suta_requests
  add column duty_location suta_duty_location;
