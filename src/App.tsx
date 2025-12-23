import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Directory } from './components/Directory'
import Teachers from './components/Teachers'
import CommandCenter from './components/CommandCenter'
import { CommandPalette } from './components/CommandPalette'
import Invoicing from './components/Invoicing'
import PublicInvoicePage from './components/PublicInvoicePage'
import ActiveRoster from './components/ActiveRoster'

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
          <Layout currentPath="/" onNavigate={(path) => navigate(path)}>
            <CommandCenter />
          </Layout>
        } />
        <Route path="/directory" element={
          <Layout currentPath="/directory" onNavigate={(path) => navigate(path)}>
            <Directory 
              selectedFamilyId={selectedFamilyId}
              onSelectFamily={setSelectedFamilyId}
            />
          </Layout>
        } />
        <Route path="/roster" element={
          <Layout currentPath="/roster" onNavigate={(path) => navigate(path)}>
            <ActiveRoster />
          </Layout>
        } />
        <Route path="/invoicing" element={
          <Layout currentPath="/invoicing" onNavigate={(path) => navigate(path)}>
            <Invoicing />
          </Layout>
        } />
        <Route path="/teachers" element={
          <Layout currentPath="/teachers" onNavigate={(path) => navigate(path)}>
            <Teachers
              selectedTeacherId={selectedTeacherId}
              onSelectTeacher={setSelectedTeacherId}
            />
          </Layout>
        } />
        <Route path="/reports" element={
          <Layout currentPath="/reports" onNavigate={(path) => navigate(path)}>
            <Placeholder title="Reports" />
          </Layout>
        } />
        <Route path="/settings" element={
          <Layout currentPath="/settings" onNavigate={(path) => navigate(path)}>
            <Placeholder title="Settings" />
          </Layout>
        } />

        {/* Public routes - NO Layout wrapper */}
        <Route path="/invoice/:publicId" element={<PublicInvoiceWrapper />} />

        {/* Catch-all redirect to directory */}
        <Route path="*" element={
          <Layout currentPath="/directory" onNavigate={(path) => navigate(path)}>
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

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">{title}</h1>
      <p className="text-muted-foreground">Coming soon...</p>
    </div>
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