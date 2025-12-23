import { useState } from 'react'
import { Layout } from './components/Layout'
import { Directory } from './components/Directory'
import Teachers from './components/Teachers'
import CommandCenter from './components/CommandCenter'
import { CommandPalette } from './components/CommandPalette'

function App() {
  const [currentPath, setCurrentPath] = useState('/directory')
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)

  // Handle command palette selection
  const handleSearchSelect = (result: { id: string; type: 'family' | 'student' | 'teacher'; name: string; familyId?: string }) => {
    switch (result.type) {
      case 'family':
        setCurrentPath('/directory')
        setSelectedFamilyId(result.id)
        break
      case 'student':
        // Students belong to families - open their family's detail panel
        setCurrentPath('/directory')
        if (result.familyId) {
          setSelectedFamilyId(result.familyId)
        }
        break
      case 'teacher':
        setCurrentPath('/teachers')
        setSelectedTeacherId(result.id)
        break
    }
  }

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <CommandCenter />
      case '/directory':
        return (
          <Directory 
            selectedFamilyId={selectedFamilyId}
            onSelectFamily={setSelectedFamilyId}
          />
        )
      case '/roster':
        return <Placeholder title="Active Roster" />
      case '/invoicing':
        return <Placeholder title="Invoicing" />
      case '/teachers':
        return (
          <Teachers
            selectedTeacherId={selectedTeacherId}
            onSelectTeacher={setSelectedTeacherId}
          />
        )
      case '/reports':
        return <Placeholder title="Reports" />
      case '/settings':
        return <Placeholder title="Settings" />
      default:
        return (
          <Directory 
            selectedFamilyId={selectedFamilyId}
            onSelectFamily={setSelectedFamilyId}
          />
        )
    }
  }

  return (
    <>
      <CommandPalette onSelect={handleSearchSelect} />
      <Layout currentPath={currentPath} onNavigate={setCurrentPath}>
        {renderPage()}
      </Layout>
    </>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">{title}</h1>
      <p className="text-muted-foreground">Coming soon...</p>
    </div>
  )
}

export default App