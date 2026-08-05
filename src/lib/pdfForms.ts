import { PDFDocument } from 'pdf-lib'
import type { PDFForm } from 'pdf-lib'
import { GEAR_CATEGORY_LABEL } from './gearRequests'
import { SUTA_REQUEST_TYPE_LABEL, SUTA_DUTY_LOCATION_LABEL, SUTA_DUTY_LOCATION_CITY } from './sutaRequests'
import type { DrillEvent, GearRequest, Soldier, SutaRequest, SutaRequestType } from '../types/database'

// Maps a SUTA request type to the export value of its radio widget on
// NC ARNG Form 350-2R's Group14 -- determined by inspecting the template's
// widget positions (top-to-bottom, left-to-right): BEFORE, AFTER, RMA on the
// left column, PRESENT AT ALTERNATE LOCATION and AUTHORIZED ABSENCE on the right.
const SUTA_REQUEST_TYPE_CHOICE: Record<SutaRequestType, string> = {
  suta_before: 'Choice1',
  suta_after: 'Choice2',
  rma: 'Choice3',
  present_at_alt_location: 'Choice4',
  authorized_absence: 'Choice5',
}

async function loadTemplate(path: string): Promise<PDFDocument> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`)
  if (!res.ok) throw new Error(`Failed to load form template: ${path}`)
  return PDFDocument.load(await res.arrayBuffer())
}

// The CCDF template's fields carry Adobe-generated unique-ID suffixes (e.g.
// "ACU Top_m7y7iDt1LaoIAbqT*dZIUA") that aren't safe to hand-transcribe, so
// fields on that form are matched by their human-readable prefix instead.
function setTextByPrefix(form: PDFForm, prefix: string, value: string) {
  const field = form.getFields().find((f) => f.getName().startsWith(prefix))
  if (!field) return
  const textField = form.getTextField(field.getName())
  textField.setText(value)
}

function selectDropdownIfOption(form: PDFForm, fieldNamePrefix: string, value: string) {
  const field = form.getFields().find((f) => f.getName().startsWith(fieldNamePrefix))
  if (!field) return
  const dropdown = form.getDropdown(field.getName())
  if (dropdown.getOptions().includes(value)) dropdown.select(value)
}

function mmddyyyy(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${month}/${day}/${year}`
}

function lastFirstMi(soldier: Soldier): string {
  const mi = soldier.middle_initial ? ` ${soldier.middle_initial}.` : ''
  return `${soldier.last_name}, ${soldier.first_name}${mi}`
}

function soldierInitials(soldier: Soldier): string {
  const first = soldier.first_name.charAt(0).toUpperCase()
  const mid = soldier.middle_initial ? soldier.middle_initial.toUpperCase() : ''
  const last = soldier.last_name.charAt(0).toUpperCase()
  return `${first}${mid}${last}`
}

export async function fillCcdfOrderForm(soldier: Soldier, request: GearRequest): Promise<Uint8Array> {
  const pdf = await loadTemplate('forms/ccdf-order-form.pdf')
  const form = pdf.getForm()

  setTextByPrefix(form, 'Name (Last, First, MI)', lastFirstMi(soldier))
  selectDropdownIfOption(form, 'Rank_', soldier.rank)
  setTextByPrefix(form, 'Date', mmddyyyy(new Date().toISOString().slice(0, 10)))
  setTextByPrefix(form, 'DOD ID', soldier.dod_id)
  setTextByPrefix(form, 'EMAIL', soldier.mil_email || soldier.personal_email || '')
  setTextByPrefix(form, 'Phone Number', soldier.phone_number || '')
  setTextByPrefix(form, 'Action Needed', `${GEAR_CATEGORY_LABEL[request.category]} -- ${request.description}`)

  setTextByPrefix(form, 'ACU Top', soldier.ocp_top_size || '')
  setTextByPrefix(form, 'ACU Bottom', soldier.ocp_bottom_size || '')
  setTextByPrefix(form, 'T-Shirt', soldier.tshirt_size || '')
  setTextByPrefix(form, 'Boots', soldier.boots_size || '')
  setTextByPrefix(form, 'Gloves', soldier.gloves_size || '')
  setTextByPrefix(form, 'ACH', soldier.ach_size || '')
  setTextByPrefix(form, 'ASU Coat', soldier.asu_coat_size || '')
  setTextByPrefix(form, 'ASU Pants', soldier.asu_pants_size || '')
  setTextByPrefix(form, 'ASU Shirt', soldier.asu_shirt_size || '')
  setTextByPrefix(form, 'Dress Shoes', soldier.dress_shoes_size || '')
  setTextByPrefix(form, 'Beret / Service Cap', soldier.beret_size || '')
  setTextByPrefix(form, 'Pro-Mask', soldier.pro_mask_size || '')
  setTextByPrefix(form, 'IBA/IOTV', soldier.iba_iotv_size || '')
  setTextByPrefix(form, 'APFU Jacket', soldier.apfu_jacket_size || '')
  // The template's own field is misspelled "AFPU Pants" -- matched as-is.
  setTextByPrefix(form, 'AFPU Pants', soldier.apfu_pants_size || '')
  setTextByPrefix(form, 'APFU T-Shirt', soldier.apfu_tshirt_size || '')
  setTextByPrefix(form, 'APFU Shorts', soldier.apfu_shorts_size || '')

  form.updateFieldAppearances()
  return pdf.save()
}

export async function fillSutaCertificate(soldier: Soldier, request: SutaRequest, event: DrillEvent): Promise<Uint8Array> {
  const pdf = await loadTemplate('forms/suta-certificate.pdf')
  const form = pdf.getForm()

  selectDropdownIfOption(form, 'RANK1', soldier.rank)
  form.getTextField('NAME').setText(lastFirstMi(soldier))
  form.getTextField('IDTS').setText(mmddyyyy(event.event_date))
  form.getTextField('IDTE').setText(mmddyyyy(event.end_date))
  if (request.requested_makeup_date) {
    form.getTextField('DDS').setText(mmddyyyy(request.requested_makeup_date))
    form.getTextField('DDE').setText(mmddyyyy(request.requested_makeup_date))
  }
  form.getTextField('DUTY').setText(
    `${event.title} (${mmddyyyy(event.event_date)}) -- ${SUTA_REQUEST_TYPE_LABEL[request.request_type ?? 'suta_before']}: ${request.reason}`,
  )
  form.getTextField('REQUEST DATE').setText(mmddyyyy(new Date().toISOString().slice(0, 10)))

  if (request.request_type) {
    try {
      form.getRadioGroup('Group14').select(SUTA_REQUEST_TYPE_CHOICE[request.request_type])
    } catch {
      // Radio option unavailable on this template revision -- leave unmarked
      // rather than fail the whole download.
    }
  }

  if (request.duty_location) {
    form.getTextField('UNIT').setText(SUTA_DUTY_LOCATION_LABEL[request.duty_location])
    // Street address isn't captured (not reliably known), so this only ever
    // carries city + state, never a fabricated street/zip.
    form.getTextField('CITY ST ZIP').setText(`${SUTA_DUTY_LOCATION_CITY[request.duty_location]}, NC`)
  }

  // Only written when the Soldier went through the in-app Section 8
  // acknowledgment popup at submission time -- older requests (or ones
  // submitted before this existed) leave INI1-INI11 blank.
  if (request.acknowledged_at) {
    const initials = soldierInitials(soldier)
    for (let i = 1; i <= 11; i++) {
      form.getTextField(`INI${i}`).setText(initials)
    }
  }

  form.updateFieldAppearances()
  return pdf.save()
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
