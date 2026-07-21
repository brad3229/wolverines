export type UserRole = 'admin' | 'soldier'
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'
export type EditRequestStatus = 'pending' | 'approved' | 'rejected'
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
export type DrillEventType = 'drill' | 'annual_training'
export type SutaStatus = 'pending' | 'approved' | 'denied'
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

export interface Profile {
  id: string
  role: UserRole
  created_at: string
}

export interface Soldier {
  id: string
  profile_id: string | null
  first_name: string
  last_name: string
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
  home_address: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  blood_type: BloodType | null
  cac_expiration_date: string | null
  receives_drill_pay: boolean
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
  status: SutaStatus
  requested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  makeup_status: MakeupStatus
  makeup_notes: string | null
  makeup_completed_at: string | null
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

export interface TaskList {
  id: string
  name: string
  description: string | null
  active: boolean
  created_by: string | null
  created_at: string
}

export interface TaskItem {
  id: string
  task_list_id: string
  label: string
  sort_order: number
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
