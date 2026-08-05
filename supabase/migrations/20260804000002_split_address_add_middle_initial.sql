-- Splits the single free-text home_address field into Street/City/State/Zip
-- so it can be mapped directly onto the SUTA certificate's ADDRESS/CITY ST ZIP
-- fields, and adds a middle initial (some Soldiers don't have one, so it's
-- nullable) so full-name PDF fields can read "Last, First MI".
alter table soldiers
  add column middle_initial text,
  add column street_address text,
  add column city text,
  add column state text,
  add column zip_code text;

update soldiers set street_address = home_address where home_address is not null;

alter table soldiers drop column home_address;
