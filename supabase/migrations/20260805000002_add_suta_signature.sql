-- Captured alongside the Section 8 acknowledgment popup at submission time --
-- the Soldier's typed name, stamped onto the PDF's own signature block
-- (Section 1, block 9) since that field is a real PDF digital-signature
-- widget pdf-lib can't fill through the normal form-field API. Only ever
-- written together with acknowledged_at.
alter table suta_requests
  add column signature_name text;
