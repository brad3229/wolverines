import type { SVGProps } from 'react'

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] flex-shrink-0"
      {...props}
    />
  )
}

export function IconDashboard(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="8" height="9" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="12" width="8" height="9" rx="1.5" />
      <rect x="3" y="16" width="8" height="5" rx="1.5" />
    </Icon>
  )
}

export function IconRoster(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      {/* Back-left soldier: helmet dome peeking out, shoulder tucked behind center figure */}
      <path d="M2.5 20.5v-1.5a3 3 0 0 1 3-3h1" />
      <path d="M3.5 11.75a2.5 2.5 0 0 1 5 0" strokeLinecap="butt" />
      <path d="M3.5 11.75v.5a2.5 2.5 0 0 0 1.2 2.13" />
      {/* Back-right soldier, mirrored */}
      <path d="M21.5 20.5v-1.5a3 3 0 0 0-3-3h-1" />
      <path d="M20.5 11.75a2.5 2.5 0 0 0-5 0" strokeLinecap="butt" />
      <path d="M20.5 11.75v.5a2.5 2.5 0 0 1-1.2 2.13" />
      {/* Front-center soldier: helmet dome + brim, face, shoulders */}
      <path d="M7.5 10.5a4.5 4.5 0 0 1 9 0" strokeLinecap="butt" />
      <path d="M7 10.5h10" />
      <path d="M8.5 10.5v.5a3.5 3.5 0 0 0 7 0v-.5" />
      <path d="M7.5 21v-2.5a4.5 4.5 0 0 1 9 0V21" />
    </Icon>
  )
}

export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="8" y1="2.5" x2="8" y2="6.5" />
      <line x1="16" y1="2.5" x2="16" y2="6.5" />
    </Icon>
  )
}

export function IconAttendance(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  )
}

export function IconProfile(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5c1.5-4 4-6 7.5-6s6 2 7.5 6" />
    </Icon>
  )
}

export function IconCheckIn(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </Icon>
  )
}

export function IconSecurity(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z" />
      <path d="M9.5 12l1.75 1.75L14.5 10" />
    </Icon>
  )
}

export function IconSuta(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="8" y1="2.5" x2="8" y2="6.5" />
      <line x1="16" y1="2.5" x2="16" y2="6.5" />
      <line x1="9" y1="14" x2="15" y2="18" />
      <line x1="15" y1="14" x2="9" y2="18" />
    </Icon>
  )
}

export function IconTasks(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M7.5 8.5l1.25 1.25L11 7.25" />
      <line x1="13.5" y1="8" x2="16.5" y2="8" />
      <path d="M7.5 14.5l1.25 1.25L11 13.25" />
      <line x1="13.5" y1="14" x2="16.5" y2="14" />
    </Icon>
  )
}

export function IconPhone(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5.5 4h3l1.5 4.5-2 1.5a11 11 0 0 0 5 5l1.5-2 4.5 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 6.2 2 2 0 0 1 5.5 4z" />
    </Icon>
  )
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon strokeWidth={3} {...props}>
      <path d="M4 12l5 5L20 6" />
    </Icon>
  )
}

// Filled dots, not stroked -- a drag-handle grip reads better solid.
export function IconGripVertical(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px] flex-shrink-0" {...props}>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  )
}

export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 10a6 6 0 0 1 12 0v4.5l1.5 3h-15l1.5-3z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Icon>
  )
}

export function IconInbox(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.5 12.5h4.5l1.5 2.5h5l1.5-2.5h4.5" />
      <path d="M5.5 12.5 7 5.5a2 2 0 0 1 2-1.5h6a2 2 0 0 1 2 1.5l1.5 7" />
      <rect x="3.5" y="12.5" width="17" height="6.5" rx="1.5" />
    </Icon>
  )
}

export function IconGear(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7.5 8V5.5A2.5 2.5 0 0 1 10 3h4a2.5 2.5 0 0 1 2.5 2.5V8" />
      <rect x="5" y="8" width="14" height="13" rx="2.5" />
      <rect x="9" y="8" width="6" height="4" rx="1" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </Icon>
  )
}

export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  )
}

export function IconCamera(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A2 2 0 0 1 9.83 3.5h4.34a2 2 0 0 1 1.73 1l.9 1.5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </Icon>
  )
}

export function IconFitness(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6.5 8.5v7M4 10v4M17.5 8.5v7M20 10v4" strokeLinecap="round" />
      <path d="M6.5 12h11" strokeLinecap="round" />
    </Icon>
  )
}

export function IconAlertTriangle(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 21 19.5H3z" />
      <line x1="12" y1="9.5" x2="12" y2="13.5" />
      <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
    </Icon>
  )
}

export function IconNote(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 3.5h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M15 3.5v3a1 1 0 0 0 1 1h3" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="14.5" x2="16" y2="14.5" />
      <line x1="8" y1="18" x2="13" y2="18" />
    </Icon>
  )
}

export function IconEvaluation(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="13" height="18" rx="1.5" />
      <line x1="7.5" y1="7.5" x2="13.5" y2="7.5" />
      <line x1="7.5" y1="11" x2="13.5" y2="11" />
      <path d="M17.5 14.5l1.1 2.2 2.4.35-1.75 1.7.4 2.4-2.15-1.15-2.15 1.15.4-2.4-1.75-1.7 2.4-.35z" />
    </Icon>
  )
}

export function IconPay(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11M15 9.25c0-1.24-1.34-2.25-3-2.25s-3 .82-3 2c0 1.5 1.5 2 3 2.25s3 .82 3 2.25-1.34 2-3 2-3-1.01-3-2.25" />
    </Icon>
  )
}

// Filled, not stroked -- a deliberate one-off exception to the rest of this
// file's line-icon style.
export function IconPasskey(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px] flex-shrink-0" {...props}>
      <path d="M15 15.5c0-.526.09-1.031.256-1.5H6.253a2.25 2.25 0 0 0-2.25 2.249v.577c0 .893.32 1.756.9 2.435C6.297 20.896 8.344 21.793 11 21.97v-1.055q0-.226.05-.445c-2.248-.157-3.904-.89-5.007-2.182a2.25 2.25 0 0 1-.54-1.46v-.578a.75.75 0 0 1 .75-.75zM12 2.004a5 5 0 1 1 0 10a5 5 0 0 1 0-10m0 1.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7M19.5 19a3.5 3.5 0 1 0-3.387-2.613l-3.82 3.82a1 1 0 0 0-.293.707V22.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V22h1a.5.5 0 0 0 .5-.5v-1h1a.5.5 0 0 0 .5-.5v-1zm.5-5a1 1 0 1 1 0 2a1 1 0 0 1 0-2" />
    </svg>
  )
}
