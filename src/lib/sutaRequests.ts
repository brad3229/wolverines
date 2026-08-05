import { supabase } from './supabaseClient'
import type { SutaRequest, SutaRequestType, SutaDutyLocation } from '../types/database'

// Matches the 5 radio choices on NC ARNG Form 350-2R (the official SUTA
// certificate) -- also used to select the matching choice when generating
// the pre-filled PDF.
export const SUTA_REQUEST_TYPE_LABEL: Record<SutaRequestType, string> = {
  suta_before: 'SUTA Before',
  suta_after: 'SUTA After',
  rma: 'RMA (only if funding is available)',
  present_at_alt_location: 'Present at Alternate Location',
  authorized_absence: 'Authorized Absence',
}

// Armories available for "location duty to be performed" -- maps onto the
// SUTA certificate's UNIT / CITY, STATE fields. Street address isn't filled
// in since it isn't reliably known here; see fillSutaCertificate.
export const SUTA_DUTY_LOCATION_LABEL: Record<SutaDutyLocation, string> = {
  jacksonville: 'Jacksonville, NC Armory',
  wilmington: 'Wilmington, NC Armory',
  lumberton: 'Lumberton, NC Armory',
  fayetteville: 'Fayetteville, NC Armory',
}

export const SUTA_DUTY_LOCATION_CITY: Record<SutaDutyLocation, string> = {
  jacksonville: 'Jacksonville',
  wilmington: 'Wilmington',
  lumberton: 'Lumberton',
  fayetteville: 'Fayetteville',
}

// The 11 acknowledgment statements from Section 8 of NC ARNG Form 350-2R --
// shown in an in-app confirmation popup at submission time (there's no way
// to collect a physical initial next to each line), and used to decide
// whether the PDF fill writes the Soldier's initials into INI1-INI11.
export const SUTA_ACKNOWLEDGMENTS: string[] = [
  'This is only a request -- the unit commander is the only approval authority.',
  'The unit commander is the only one who can give a VOCO (Verbal Orders of Commanding Officer).',
  'This request must be submitted no later than 60 days prior to the next IDT, or it may not be approved in time.',
  "I will continue to plan for the next IDT until I receive official notification of my request's approval.",
  'If I need to cancel, I will email my chain of command immediately so the unit commander is notified.',
  "It's my responsibility to properly submit and cancel my request in a timely manner.",
  "If I fail to do my part, the S1 section isn't responsible for any pay challenges or late payment I encounter.",
  'I will contact my chain of command about any pay challenges before contacting the unit S1.',
  'Failure to complete this form properly will result in my request not being processed.',
  "I will perform 8 duty hours for each day, regardless of whether it's a SUTA After or SUTA Before.",
  'My SUTA form must be certified before my unit S1 can submit my pay.',
]

export async function listSutaRequests() {
  const { data, error } = await supabase
    .from('suta_requests')
    .select('*')
    .order('requested_at', { ascending: false })
  if (error) throw error
  return data as SutaRequest[]
}

export async function listOwnSutaRequests(soldierId: string) {
  const { data, error } = await supabase
    .from('suta_requests')
    .select('*')
    .eq('soldier_id', soldierId)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return data as SutaRequest[]
}

export async function submitSutaRequest(params: {
  soldierId: string
  drillEventId: string
  reason: string
  requestType: SutaRequestType
  requestedMakeupDate?: string | null
  dutyLocation?: SutaDutyLocation | null
}) {
  const { data, error } = await supabase
    .from('suta_requests')
    .insert({
      soldier_id: params.soldierId,
      drill_event_id: params.drillEventId,
      reason: params.reason,
      request_type: params.requestType,
      status: 'pending',
      requested_makeup_date: params.requestedMakeupDate || null,
      duty_location: params.dutyLocation || null,
      // Only ever called after the Soldier confirms the Section 8 acknowledgment
      // popup, so it's safe to stamp this at submit time.
      acknowledged_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data as SutaRequest
}

export async function reviewSutaRequest(params: { id: string; approve: boolean; reviewedBy: string }) {
  const { data, error } = await supabase
    .from('suta_requests')
    .update({
      status: params.approve ? 'approved' : 'denied',
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
      makeup_status: params.approve ? 'pending' : 'not_required',
    })
    .eq('id', params.id)
    .select()
    .single()
  if (error) throw error
  return data as SutaRequest
}

export async function markMakeupComplete(params: { id: string; notes: string }) {
  const { data, error } = await supabase
    .from('suta_requests')
    .update({
      makeup_status: 'completed',
      makeup_notes: params.notes || null,
      makeup_completed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()
  if (error) throw error
  return data as SutaRequest
}
