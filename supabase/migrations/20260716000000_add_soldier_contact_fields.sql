-- Soldier contact, emergency, and administrative info
create type blood_type as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

alter table soldiers
  add column phone_number text,
  add column personal_email text,
  add column mil_email text,
  add column home_address text,
  add column emergency_contact_name text,
  add column emergency_contact_relationship text,
  add column emergency_contact_phone text,
  add column blood_type blood_type,
  add column cac_expiration_date date;
