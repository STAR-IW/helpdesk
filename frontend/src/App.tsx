
import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [healthStatus, setHealthStatus] = useState('checking...')

  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then((res) => res.json())
      .then((data) => setHealthStatus(data.status))
      .catch(() => setHealthStatus('unreachable'))
  }, [])

  return (
    <div>
      <h1>Helpdesk</h1>
      <p>Backend status: {healthStatus}</p>
    </div>
  )
}

export default App
