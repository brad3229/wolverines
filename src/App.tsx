import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthState } from './hooks/useAuth'
import { RequireRole } from './components/RequireRole'
import { Layout } from './components/Layout'
import type { NavItem } from './components/Layout'
import { MfaChallenge } from './components/MfaChallenge'
import { SetPassword } from './components/SetPassword'
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
} from './components/icons'
import { Login } from './routes/Login'
import { Dashboard as AdminDashboard } from './routes/admin/Dashboard'
import { Roster } from './routes/admin/Roster'
import { SoldierDetail } from './routes/admin/SoldierDetail'
import { Calendar } from './routes/admin/Calendar'
import { AttendancePage } from './routes/admin/Attendance'
import { AttendanceHome } from './routes/admin/AttendanceHome'
import { Suta as AdminSuta } from './routes/admin/Suta'
import { PayIssues as AdminPayIssues } from './routes/admin/PayIssues'
import { Security } from './routes/admin/Security'
import { Dashboard as SoldierDashboard } from './routes/soldier/Dashboard'
import { Profile } from './routes/soldier/Profile'
import { SoldierCalendar } from './routes/soldier/Calendar'
import { CheckIn } from './routes/soldier/CheckIn'
import { CheckInHome } from './routes/soldier/CheckInHome'
import { Suta as SoldierSuta } from './routes/soldier/Suta'
import { PayIssues as SoldierPayIssues } from './routes/soldier/PayIssues'

function buildAdminNav(pendingSutaCount: number, pendingEditRequestCount: number, pendingPayIssueCount: number): NavItem[] {
  return [
    {
      to: '/admin/dashboard',
      label: 'Dashboard',
      shortLabel: 'Dash',
      icon: <IconDashboard />,
      badge: pendingEditRequestCount,
    },
    { to: '/admin/roster', label: 'Roster', icon: <IconRoster /> },
    { to: '/admin/calendar', label: 'Calendar', shortLabel: 'Cal', icon: <IconCalendar /> },
    { to: '/admin/attendance', label: 'Attendance', shortLabel: 'Attnd', icon: <IconAttendance /> },
    { to: '/admin/suta', label: 'Review SUTA', shortLabel: 'Review', icon: <IconSuta />, badge: pendingSutaCount },
    { to: '/admin/my-suta', label: 'My SUTA', icon: <IconSuta /> },
    { to: '/admin/pay-issues', label: 'Pay Issues', shortLabel: 'Pay', icon: <IconPay />, badge: pendingPayIssueCount },
    { to: '/admin/security', label: 'Security', shortLabel: 'Sec', icon: <IconSecurity /> },
  ]
}

const SOLDIER_NAV: NavItem[] = [
  { to: '/soldier/dashboard', label: 'Dashboard', shortLabel: 'Dash', icon: <IconDashboard /> },
  { to: '/soldier/profile', label: 'Profile', icon: <IconProfile /> },
  { to: '/soldier/calendar', label: 'Calendar', shortLabel: 'Cal', icon: <IconCalendar /> },
  { to: '/soldier/checkin', label: 'Check-In', icon: <IconCheckIn /> },
  { to: '/soldier/suta', label: 'SUTA', icon: <IconSuta /> },
  { to: '/soldier/pay-issues', label: 'Pay Issues', shortLabel: 'Pay', icon: <IconPay /> },
]

function App() {
  const auth = useAuthState()
  const [passwordJustSet, setPasswordJustSet] = useState(false)
  const adminNav = buildAdminNav(auth.pendingSutaCount, auth.pendingEditRequestCount, auth.pendingPayIssueCount)

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

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
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
                <Layout navItems={adminNav} mobileNav="menu">
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
            path="/soldier/dashboard"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV}>
                  <SoldierDashboard />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/profile"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV}>
                  <Profile />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/calendar"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV}>
                  <SoldierCalendar />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/calendar/:eventId"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV}>
                  <CheckIn />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/checkin"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV}>
                  <CheckInHome />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/suta"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV}>
                  <SoldierSuta />
                </Layout>
              </RequireRole>
            }
          />
          <Route
            path="/soldier/pay-issues"
            element={
              <RequireRole allow={['soldier']}>
                <Layout navItems={SOLDIER_NAV}>
                  <SoldierPayIssues />
                </Layout>
              </RequireRole>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default App
