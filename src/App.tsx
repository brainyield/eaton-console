import { useState } from 'react'
import { Layout } from './components/Layout'
import { Directory } from './components/Directory'
import Teachers from './components/Teachers'
import CommandCenter from './components/CommandCenter'

function App() {
  const [currentPath, setCurrentPath] = useState('/directory')

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <CommandCenter />
      case '/directory':
        return <Directory />
      case '/roster':
        return <Placeholder title="Active Roster" />
      case '/invoicing':
        return <Placeholder title="Invoicing" />
      case '/teachers':
        return <Teachers />
      case '/reports':
        return <Placeholder title="Reports" />
      case '/settings':
        return <Placeholder title="Settings" />
      default:
        return <Directory />
    }
  }

  return (
    <Layout currentPath={currentPath} onNavigate={setCurrentPath}>
      {renderPage()}
    </Layout>
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