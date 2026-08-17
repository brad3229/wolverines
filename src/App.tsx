import { Suspense, lazy, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthState } from './hooks/useAuth'
import { RequireRole } from './components/RequireRole'
import { Layout } from './components/Layout'
import type { NavItem } from './components/Layout'
import { MfaChallenge } from './components/MfaChallenge'
import { MfaEnrollmentRequired } from './components/MfaEnrollmentRequired'
import { SetPassword } from './components/SetPassword'
import { LoadingScreen } from './components/LoadingScreen'
import { initialAuthFlowType } from './lib/authFlow'
import {
  IconDashboard,
  IconRoster,
  IconCalendar,
  IconAttendance,
  IconProfile,
  IconCheckIn,
  IconSuta,
  IconPay,
  IconSecurity,
  IconTasks,
  IconGear,
  IconSettings,
  IconFitness,
  IconPhone,
  IconAlertTriangle,
} from './components/icons'
import { Login } from './routes/Login'

// Route components are lazy-loaded so each page only ships the JS it needs,
// instead of bundling every admin and soldier screen into one initial download.
const AdminDashboard = lazy(() => import('./routes/admin/Dashboard').then((m) => ({ default: m.Dashboard })))
const Roster = lazy(() => import('./routes/admin/Roster').then((m) => ({ default: m.Roster })))
const SoldierDetail = lazy(() => import('./routes/admin/SoldierDetail').then((m) => ({ default: m.SoldierDetail })))
const Calendar = lazy(() => import('./routes/admin/Calendar').then((m) => ({ default: m.Calendar })))
const AttendancePage = lazy(() => import('./routes/admin/Attendance').then((m) => ({ default: m.AttendancePage })))
const AttendanceHome = lazy(() => import('./routes/admin/AttendanceHome').then((m) => ({ default: m.AttendanceHome })))
const AdminSuta = lazy(() => import('./routes/admin/Suta').then((m) => ({ default: m.Suta })))
const AdminPayIssues = lazy(() => import('./routes/admin/PayIssues').then((m) => ({ default: m.PayIssues })))
const AdminGearRequests = lazy(() =>
  import('./routes/admin/GearRequests').then((m) => ({ default: m.GearRequests })),
)
const AdminNcoer = lazy(() => import('./routes/admin/Ncoer').then((m) => ({ default: m.Ncoer })))
const AdminReadiness = lazy(() => import('./routes/admin/Readiness').then((m) => ({ default: m.Readiness })))
const AdminAft = lazy(() => import('./routes/admin/Aft').then((m) => ({ default: m.Aft })))
const Security = lazy(() => import('./routes/admin/Security').then((m) => ({ default: m.Security })))
const AdminTaskLists = lazy(() => import('./routes/admin/TaskLists').then((m) => ({ default: m.TaskLists })))
const AdminTaskListDetail = lazy(() =>
  import('./routes/admin/TaskListDetail').then((m) => ({ default: m.TaskListDetail })),
)
const SoldierDashboard = lazy(() => import('./routes/soldier/Dashboard').then((m) => ({ default: m.Dashboard })))
const Profile = lazy(() => import('./routes/soldier/Profile').then((m) => ({ default: m.Profile })))
const SoldierCalendar = lazy(() => import('./routes/soldier/Calendar').then((m) => ({ default: m.SoldierCalendar })))
const CheckIn = lazy(() => import('./routes/soldier/CheckIn').then((m) => ({ default: m.CheckIn })))
const CheckInHome = lazy(() => import('./routes/soldier/CheckInHome').then((m) => ({ default: m.CheckInHome })))
const SoldierSuta = lazy(() => import('./routes/soldier/Suta').then((m) => ({ default: m.Suta })))
const SoldierPayIssues = lazy(() => import('./routes/soldier/PayIssues').then((m) => ({ default: m.PayIssues })))
const SoldierGearRequests = lazy(() =>
  import('./routes/soldier/GearRequests').then((m) => ({ default: m.GearRequests })),
)
const SoldierTasks = lazy(() => import('./routes/soldier/Tasks').then((m) => ({ default: m.Tasks })))
const SoldierAft = lazy(() => import('./routes/soldier/Aft').then((m) => ({ default: m.Aft })))
const PlatoonDirectory = lazy(() =>
  import('./routes/soldier/PlatoonDirectory').then((m) => ({ default: m.PlatoonDirectory })),
)
const Settings = lazy(() => import('./routes/Settings').then((m) => ({ default: m.Settings })))

function buildAdminNav(
  pendingSutaCount: number,
  pendingEditRequestCount: number,
  pendingPayIssueCount: number,
  pendingTaskVerificationCount: number,
  pendingGearRequestCount: number,
): NavItem[] {
  return [
    {
      to: '/admin/dashboard',
      label: 'Dashboard',
      shortLabel: 'Dash',
      icon: <IconDashboard />,
      badge: pendingEditRequestCount,
      group: 'Operations',
    },
    { to: '/admin/roster', label: 'Roster', icon: <IconRoster />, group: 'Operations' },
    { to: '/admin/calendar', label: 'Drill Dates', shortLabel: 'Drills', icon: <IconCalendar />, group: 'Operations' },
    { to: '/admin/attendance', label: 'Attendance', shortLabel: 'Attnd', icon: <IconAttendance />, group: 'Operations' },
    {
      to: '/admin/suta',
      label: 'Review SUTA',
      shortLabel: 'Review',
      icon: <IconSuta />,
      badge: pendingSutaCount,
      group: 'Requests & Readiness',
    },
    { to: '/admin/my-suta', label: 'My SUTA', icon: <IconSuta />, group: 'Requests & Readiness' },
    {
      to: '/admin/pay-issues',
      label: 'Pay Issues',
      shortLabel: 'Pay',
      icon: <IconPay />,
      badge: pendingPayIssueCount,
      group: 'Requests & Readiness',
    },
    {
      to: '/admin/gear-requests',
      label: 'Gear Requests',
      shortLabel: 'Gear',
      icon: <IconGear />,
      badge: pendingGearRequestCount,
      group: 'Requests & Readiness',
    },
    {
      to: '/admin/tasks',
      label: 'Tasks',
      icon: <IconTasks />,
      badge: pendingTaskVerificationCount,
      group: 'Requests & Readiness',
    },
    { to: '/admin/aft', label: 'AFT', icon: <IconFitness />, group: 'Requests & Readiness' },
    { to: '/admin/readiness', label: 'Readiness Matrix', shortLabel: 'Ready', icon: <IconAlertTriangle />, group: 'Requests & Readiness' },
    { to: '/admin/security', label: 'Security', shortLabel: 'Sec', icon: <IconSecurity />, group: 'System' },
    { to: '/admin/settings', label: 'Settings', icon: <IconSettings />, group: 'System' },
  ]
}

const SOLDIER_NAV: NavItem[] = [
  { to: '/soldier/dashboard', label: 'Dashboard', shortLabel: 'Dash', icon: <IconDashboard /> },
  { to: '/soldier/profile', label: 'Profile', icon: <IconProfile /> },
  { to: '/soldier/calendar', label: 'Drill Dates', shortLabel: 'Drills', icon: <IconCalendar /> },
  { to: '/soldier/checkin', label: 'Check-In', icon: <IconCheckIn /> },
  { to: '/soldier/squad', label: 'My Platoon', icon: <IconPhone /> },
  { to: '/soldier/suta', label: 'SUTA', icon: <IconSuta /> },
  { to: '/soldier/pay-issues', label: 'Pay Issues', shortLabel: 'Pay', icon: <IconPay /> },
  { to: '/soldier/gear-requests', label: 'Gear Requests', shortLabel: 'Gear', icon: <IconGear /> },
  { to: '/soldier/tasks', label: 'Tasks', icon: <IconTasks /> },
  { to: '/soldier/aft', label: 'AFT', icon: <IconFitness /> },
  { to: '/soldier/settings', label: 'Settings', icon: <IconSettings /> },
]

function App() {
  const auth = useAuthState()
  const [passwordJustSet, setPasswordJustSet] = useState(false)
  const adminNav = buildAdminNav(
    auth.pendingSutaCount,
    auth.pendingEditRequestCount,
    auth.pendingPayIssueCount,
    auth.pendingTaskVerificationCount,
    auth.pendingGearRequestCount,
  )

  const needsPasswordSetup =
    (initialAuthFlowType === 'invite' || initialAuthFlowType === 'recovery') && auth.session && !passwordJustSet

  if (needsPasswordSetup) {
    return (
      <AuthContext.Provider value={auth}>
        <SetPassword onDone={() => setPasswordJustSet(true)} />
      </AuthContext.Provider>
    )
  }

  if (auth.session && auth.needsMfaChallenge) {
    return (
      <AuthContext.Provider value={auth}>
        <MfaChallenge />
      </AuthContext.Provider>
    )
  }

  if (auth.session && auth.needsMfaEnrollment) {
    return (
      <AuthContext.Provider value={auth}>
        <MfaEnrollmentRequired />
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Supabase auth emails (invite, magic link, password reset) redirect to the
              bare site root with the session token in the URL hash. Rendering Login here
              (instead of an immediate <Navigate> to /login) lets its own session check
              wait for that hash to be consumed before anything touches the URL. */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/admin/dashboard"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu" profileLink="/admin/settings" profileLinkLabel="Settings">
                  <AdminDashboard />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/roster"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <Roster />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/roster/:id"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <SoldierDetail />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/calendar"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <Calendar />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/calendar/:eventId"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AttendancePage />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AttendanceHome />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/suta"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AdminSuta />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/my-suta"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <SoldierSuta />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/pay-issues"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AdminPayIssues />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/gear-requests"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AdminGearRequests />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/ncoer"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AdminNcoer />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/aft"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AdminAft />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/readiness"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AdminReadiness />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/tasks"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AdminTaskLists />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/tasks/:id"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <AdminTaskListDetail />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/security"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <Security />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <RequireRole allow={['admin']}>
                <Layout navItems={adminNav} mobileNav="menu">
                  <Settings />
                </Layout>
              </RequireRole>
            }
          />

          <Route
            path="/soldier/dashboard"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu" profileLink="/soldier/profile">
                  <SoldierDashboard />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/profile"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <Profile />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/calendar"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <SoldierCalendar />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/calendar/:eventId"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <CheckIn />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/checkin"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <CheckInHome />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/suta"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <SoldierSuta />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/pay-issues"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <SoldierPayIssues />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/gear-requests"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <SoldierGearRequests />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/tasks"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <SoldierTasks />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/aft"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <SoldierAft />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/squad"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <PlatoonDirectory />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/settings"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV} mobileNav="menu">
                  <Settings />
                </Layout>
              </RequireRole>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default App
