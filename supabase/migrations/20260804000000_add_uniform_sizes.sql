-- Uniform/OCIE sizes, captured once on the Soldier record so the CCDF Order
-- Form PDF can be auto-filled from any Gear Request without re-asking.
alter table soldiers
  add column ocp_top_size text,
  add column ocp_bottom_size text,
  add column tshirt_size text,
  add column boots_size text,
  add column gloves_size text,
  add column ach_size text,
  add column asu_coat_size text,
  add column asu_pants_size text,
  add column asu_shirt_size text,
  add column dress_shoes_size text,
  add column beret_size text,
  add column pro_mask_size text,
  add column iba_iotv_size text,
  add column apfu_jacket_size text,
  add column apfu_pants_size text,
  add column apfu_tshirt_size text,
  add column apfu_shorts_size text;
