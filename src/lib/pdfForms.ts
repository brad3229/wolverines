import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PDFForm } from 'pdf-lib'
import { GEAR_CATEGORY_LABEL } from './gearRequests'
import { SUTA_REQUEST_TYPE_LABEL, SUTA_DUTY_LOCATION_ADDRESS } from './sutaRequests'
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

// The SUTA template's own signature blocks are real PDF digital-signature
// widgets (not text fields), which pdf-lib can't fill through the normal
// form-field API -- this draws the typed name directly onto the page at the
// widget's position instead. A visual stamp, not a cryptographic signature.
async function stampSignature(pdf: PDFDocument, form: PDFForm, fieldName: string, text: string) {
  const field = form.getField(fieldName)
  const widget = field.acroField.getWidgets()[0]
  if (!widget) return
  const rect = widget.getRectangle()
  const font = await pdf.embedFont(StandardFonts.TimesRomanItalic)
  const fontSize = Math.min(rect.height * 0.55, 16)
  pdf.getPages()[0].drawText(text, {
    x: rect.x + 4,
    y: rect.y + rect.height * 0.28,
    size: fontSize,
    font,
    color: rgb(0.1, 0.1, 0.35),
  })
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
    form.getTextField('DDE').setText(mmddyyyy(request.requested_makeup_end_date || request.requested_makeup_date))
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
    const address = SUTA_DUTY_LOCATION_ADDRESS[request.duty_location]
    form.getTextField('ADDRESS').setText(address.street)
    form.getTextField('CITY ST ZIP').setText(`${address.city}, NC ${address.zip}`)
  }

  // "UNIT (IF DIFFERENT)" is the company the training will be performed
  // with (e.g. "A CO 1-120 IN"), not the armory location.
  if (request.duty_unit) {
    form.getTextField('UNIT').setText(request.duty_unit)
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

  // "Signature5" is block 9 (the Soldier's own signature) despite the name --
  // the template's internal field numbering doesn't match the visual layout;
  // verified by matching each Signature widget's position against its
  // neighboring name/date field.
  if (request.signature_name) {
    await stampSignature(pdf, form, 'Signature5', request.signature_name)
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

// Opens the PDF in a new tab using the browser's built-in viewer instead of
// forcing a save-as dialog -- lets the Soldier/admin check it's filled out
// correctly before deciding to keep a copy (the viewer has its own download
// button for that). Not revoked immediately since the new tab needs time to
// load the blob URL.
export function previewPdf(bytes: Uint8Array) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
