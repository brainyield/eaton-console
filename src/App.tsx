import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Directory } from './components/Directory'
import Teachers from './components/Teachers'
import CommandCenter from './components/CommandCenter'
import { CommandPalette } from './components/CommandPalette'
import Invoicing from './components/Invoicing'
import Payroll from './components/Payroll'
import PublicInvoicePage from './components/PublicInvoicePage'
import TeacherDesk from './components/TeacherDesk'
import CheckinForm from './components/CheckinForm'
import { PublicErrorBoundary } from './components/ui/PublicErrorBoundary'
import ActiveRoster from './components/ActiveRoster'
import Events from './components/Events'
import Marketing from './components/Marketing'
import Reports from './components/Reports'
import Settings from './components/Settings'
import AdminGate from './components/AdminGate'
import SmsLog from './pages/SmsLog'
import QuickSend from './pages/QuickSend'

// Wrapper component that provides navigation context
function AppContent() {
  const navigate = useNavigate()
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)

  const handleSearchSelect = (result: { id: string; type: 'family' | 'student' | 'teacher'; name: string; familyId?: string }) => {
    switch (result.type) {
      case 'family':
        navigate('/directory')
        setSelectedFamilyId(result.id)
        break
      case 'student':
        navigate('/directory')
        if (result.familyId) {
          setSelectedFamilyId(result.familyId)
        }
        break
      case 'teacher':
        navigate('/teachers')
        setSelectedTeacherId(result.id)
        break
    }
  }

  return (
    <Routes>
      {/* Public routes - NO Layout wrapper, NO AdminGate */}
      <Route path="/invoice/:publicId" element={<PublicInvoiceWrapper />} />
      <Route path="/desk/:token" element={<TeacherDeskWrapper />} />
      <Route path="/desk/:token/checkin/:periodId" element={<CheckinFormWrapper />} />

      {/* Admin routes - wrapped in AdminGate and Layout */}
      <Route path="/" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <CommandCenter />
          </Layout>
        </AdminGate>
      } />
      <Route path="/directory" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/directory" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Directory
              selectedFamilyId={selectedFamilyId}
              onSelectFamily={setSelectedFamilyId}
            />
          </Layout>
        </AdminGate>
      } />
      <Route path="/roster" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/roster" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <ActiveRoster />
          </Layout>
        </AdminGate>
      } />
      <Route path="/events" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/events" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Events />
          </Layout>
        </AdminGate>
      } />
      <Route path="/marketing" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/marketing" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Marketing />
          </Layout>
        </AdminGate>
      } />
      <Route path="/sms-log" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/sms-log" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <SmsLog />
          </Layout>
        </AdminGate>
      } />
      <Route path="/quick-send" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/quick-send" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <QuickSend />
          </Layout>
        </AdminGate>
      } />
      <Route path="/invoicing" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/invoicing" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Invoicing />
          </Layout>
        </AdminGate>
      } />
      <Route path="/payroll" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/payroll" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Payroll />
          </Layout>
        </AdminGate>
      } />
      <Route path="/teachers" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/teachers" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Teachers
              selectedTeacherId={selectedTeacherId}
              onSelectTeacher={setSelectedTeacherId}
            />
          </Layout>
        </AdminGate>
      } />
      <Route path="/reports" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/reports" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Reports />
          </Layout>
        </AdminGate>
      } />
      <Route path="/settings" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/settings" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Settings />
          </Layout>
        </AdminGate>
      } />

      {/* Catch-all redirect to directory */}
      <Route path="*" element={
        <AdminGate>
          <CommandPalette onSelect={handleSearchSelect} />
          <Layout currentPath="/directory" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Directory
              selectedFamilyId={selectedFamilyId}
              onSelectFamily={setSelectedFamilyId}
            />
          </Layout>
        </AdminGate>
      } />
    </Routes>
  )
}

// Wrapper to extract publicId param for public invoice page
function PublicInvoiceWrapper() {
  const { publicId } = useParams<{ publicId: string }>()
  if (!publicId) {
    return <div className="p-8 text-center">Invoice ID not provided</div>
  }
  return (
    <PublicErrorBoundary pageName="PublicInvoicePage">
      <PublicInvoicePage publicId={publicId} />
    </PublicErrorBoundary>
  )
}

// Wrapper to extract token param for teacher desk
function TeacherDeskWrapper() {
  const { token } = useParams<{ token: string }>()
  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Invalid desk link</div>
      </div>
    )
  }
  return (
    <PublicErrorBoundary pageName="TeacherDesk">
      <TeacherDesk token={token} />
    </PublicErrorBoundary>
  )
}

// Wrapper to extract params for check-in form
function CheckinFormWrapper() {
  const { token, periodId } = useParams<{ token: string; periodId: string }>()
  if (!token || !periodId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Invalid check-in link</div>
      </div>
    )
  }
  return (
    <PublicErrorBoundary pageName="CheckinForm">
      <CheckinForm token={token} periodId={periodId} />
    </PublicErrorBoundary>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App