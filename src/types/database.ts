export type UserRole = 'admin' | 'soldier'
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'
export type EditRequestStatus = 'pending' | 'approved' | 'rejected'
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
export type DrillEventType = 'drill' | 'annual_training'
export type SutaStatus = 'pending' | 'approved' | 'denied'
export type SutaRequestType = 'suta_before' | 'suta_after' | 'rma' | 'present_at_alt_location' | 'authorized_absence'
export type SutaDutyLocation = 'jacksonville' | 'wilmington' | 'lumberton' | 'fayetteville'
export type MakeupStatus = 'not_required' | 'pending' | 'completed'
export type PayIssueCategory =
  | 'missing_pay'
  | 'incorrect_amount'
  | 'les_error'
  | 'allotment_issue'
  | 'va_disability_waiver'
  | 'other'
export type PayIssueStatus = 'open' | 'in_progress' | 'resolved'
export type TaskCompletionStatus = 'incomplete' | 'self_reported' | 'verified'
export type GearRequestCategory = 'initial_issue' | 'missing_lost' | 'damaged' | 'wrong_size' | 'other'
export type GearRequestStatus = 'open' | 'in_progress' | 'resolved'
export type Sex = 'male' | 'female'
export type Platoon = '1st Platoon' | '2nd Platoon' | '3rd Platoon' | 'HQ Platoon'
export type Squad = '1st Squad' | '2nd Squad' | '3rd Squad' | '4th Squad'
export type Team = 'Alpha Team' | 'Bravo Team'
export type AftStandard = 'combat' | 'general'
export type AftRunEventType = 'two_mile_run' | 'row_5k' | 'swim_1k' | 'bike_12k' | 'walk_2_5mi'
export type AftResult = 'go' | 'nogo'
export type MrcStatus = '1' | '2' | '3' | '4'

export interface Profile {
  id: string
  role: UserRole
  created_at: string
}

// What platoonmates_directory() returns -- deliberately just enough for a
// phone directory, not a full Soldier record. same_squad lets the UI list
// the caller's own squad first, then the rest of the platoon.
export interface Platoonmate {
  id: string
  first_name: string
  last_name: string
  rank: string
  phone_number: string | null
  avatar_url: string | null
  same_squad: boolean
}

export interface Soldier {
  id: string
  profile_id: string | null
  first_name: string
  last_name: string
  middle_initial: string | null
  rank: string
  date_of_rank: string
  dod_id: string
  ets_date: string
  is_nco: boolean
  last_ncoer_date: string | null
  status: string
  phone_number: string | null
  personal_email: string | null
  mil_email: string | null
  street_address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  blood_type: BloodType | null
  cac_expiration_date: string | null
  receives_drill_pay: boolean
  has_gtcc: boolean
  mrc_status: MrcStatus | null
  sex: Sex | null
  avatar_url: string | null
  platoon: Platoon | null
  squad: Squad | null
  team: Team | null
  ocp_top_size: string | null
  ocp_bottom_size: string | null
  tshirt_size: string | null
  boots_size: string | null
  gloves_size: string | null
  ach_size: string | null
  asu_coat_size: string | null
  asu_pants_size: string | null
  asu_shirt_size: string | null
  dress_shoes_size: string | null
  beret_size: string | null
  pro_mask_size: string | null
  iba_iotv_size: string | null
  apfu_jacket_size: string | null
  apfu_pants_size: string | null
  apfu_tshirt_size: string | null
  apfu_shorts_size: string | null
  created_at: string
  updated_at: string
}

export interface DrillEvent {
  id: string
  title: string
  event_type: DrillEventType
  event_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Attendance {
  id: string
  drill_event_id: string
  soldier_id: string
  status: AttendanceStatus
  reason: string | null
  marked_by: string | null
  marked_at: string
  confirmed_by: string | null
  confirmed_at: string | null
}

export interface EditRequest {
  id: string
  soldier_id: string
  field_name: string
  old_value: string | null
  new_value: string
  status: EditRequestStatus
  requested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
}

export interface SutaRequest {
  id: string
  soldier_id: string
  drill_event_id: string
  reason: string
  request_type: SutaRequestType | null
  status: SutaStatus
  requested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  makeup_status: MakeupStatus
  makeup_notes: string | null
  makeup_completed_at: string | null
  requested_makeup_date: string | null
  requested_makeup_end_date: string | null
  acknowledged_at: string | null
  signature_name: string | null
  duty_location: SutaDutyLocation | null
  duty_unit: string | null
  correction_notes: string | null
}

export interface PayIssue {
  id: string
  soldier_id: string
  category: PayIssueCategory
  description: string
  status: PayIssueStatus
  reported_at: string
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
}

export interface GearRequest {
  id: string
  soldier_id: string
  category: GearRequestCategory
  description: string
  status: GearRequestStatus
  reported_at: string
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
  correction_notes: string | null
}

export interface TaskList {
  id: string
  name: string
  description: string | null
  active: boolean
  created_by: string | null
  created_at: string
  assigned_to_all: boolean
}

export interface TaskItem {
  id: string
  task_list_id: string
  label: string
  sort_order: number
  created_at: string
}

export interface TaskListAssignment {
  id: string
  task_list_id: string
  soldier_id: string
  created_at: string
}

export interface SoldierTaskCompletion {
  id: string
  soldier_id: string
  task_item_id: string
  status: TaskCompletionStatus
  reported_by: string | null
  reported_at: string | null
  verified_by: string | null
  verified_at: string | null
  notes: string | null
}

export interface AftTest {
  id: string
  soldier_id: string
  test_date: string
  standard: AftStandard
  aoc_mos: string | null
  rank_at_test: string | null
  age: number | null
  deadlift_lbs: number | null
  deadlift_points: number | null
  pushup_reps: number | null
  pushup_points: number | null
  sdc_time: string | null
  sdc_points: number | null
  plank_time: string | null
  plank_points: number | null
  run_event_type: AftRunEventType
  run_event_time: string | null
  run_event_points: number | null
  total_points: number | null
  overall_result: AftResult | null
  created_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  profile_id: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

export interface Counseling {
  id: string
  soldier_id: string
  session_date: string
  organization: string
  counselor_name: string
  purpose: string
  key_points: string
  plan_of_action: string
  leader_responsibilities: string | null
  individual_remarks: string | null
  assessment: string | null
  acknowledgment: 'agree' | 'disagree' | null
  acknowledged_at: string | null
  signature_name: string | null
  created_by: string | null
  created_at: string
}

export type WeaponsQualTableType = 'practice' | 'qualification'
export type WeaponsQualRating = 'expert' | 'sharpshooter' | 'marksman' | 'unqualified'

export interface WeaponsQualification {
  id: string
  soldier_id: string
  qual_date: string
  weapon_type: string
  equipment_optics: string | null
  lane_firing_order: string | null
  table_type: WeaponsQualTableType
  phase1_hits: number | null
  phase2_hits: number | null
  phase3_hits: number | null
  phase4_hits: number | null
  total_hits: number | null
  qualification_rating: WeaponsQualRating | null
  range_oic_name: string | null
  remarks: string | null
  created_by: string | null
  created_at: string
}

export interface ReadinessSnapshot {
  id: string
  month: string
  deployable_pct: number
  go_count: number
  at_risk_count: number
  no_go_count: number
  total_count: number
  created_at: string
  updated_at: string
}
