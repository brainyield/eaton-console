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
import ActiveRoster from './components/ActiveRoster'
import Events from './components/Events'
import Marketing from './components/Marketing'
import Reports from './components/Reports'
import Settings from './components/Settings'

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
    <>
      <CommandPalette onSelect={handleSearchSelect} />
      <Routes>
        {/* Admin routes - wrapped in Layout */}
        <Route path="/" element={
          <Layout currentPath="/" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <CommandCenter />
          </Layout>
        } />
        <Route path="/directory" element={
          <Layout currentPath="/directory" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Directory
              selectedFamilyId={selectedFamilyId}
              onSelectFamily={setSelectedFamilyId}
            />
          </Layout>
        } />
        <Route path="/roster" element={
          <Layout currentPath="/roster" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <ActiveRoster />
          </Layout>
        } />
        <Route path="/events" element={
          <Layout currentPath="/events" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Events />
          </Layout>
        } />
        <Route path="/marketing" element={
          <Layout currentPath="/marketing" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Marketing />
          </Layout>
        } />
        <Route path="/invoicing" element={
          <Layout currentPath="/invoicing" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Invoicing />
          </Layout>
        } />
        <Route path="/payroll" element={
          <Layout currentPath="/payroll" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Payroll />
          </Layout>
        } />
        <Route path="/teachers" element={
          <Layout currentPath="/teachers" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Teachers
              selectedTeacherId={selectedTeacherId}
              onSelectTeacher={setSelectedTeacherId}
            />
          </Layout>
        } />
        <Route path="/reports" element={
          <Layout currentPath="/reports" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Reports />
          </Layout>
        } />
        <Route path="/settings" element={
          <Layout currentPath="/settings" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Settings />
          </Layout>
        } />

        {/* Public routes - NO Layout wrapper */}
        <Route path="/invoice/:publicId" element={<PublicInvoiceWrapper />} />
        <Route path="/desk/:token" element={<TeacherDeskWrapper />} />
        <Route path="/desk/:token/checkin/:periodId" element={<CheckinFormWrapper />} />

        {/* Catch-all redirect to directory */}
        <Route path="*" element={
          <Layout currentPath="/directory" onNavigate={(path) => navigate(path)} onSelectFamily={setSelectedFamilyId}>
            <Directory
              selectedFamilyId={selectedFamilyId}
              onSelectFamily={setSelectedFamilyId}
            />
          </Layout>
        } />
      </Routes>
    </>
  )
}

// Wrapper to extract publicId param for public invoice page
function PublicInvoiceWrapper() {
  const { publicId } = useParams<{ publicId: string }>()
  if (!publicId) {
    return <div className="p-8 text-center">Invoice ID not provided</div>
  }
  return <PublicInvoicePage publicId={publicId} />
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
  return <TeacherDesk token={token} />
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
  return <CheckinForm token={token} periodId={periodId} />
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App