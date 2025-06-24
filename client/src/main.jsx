import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CompanyInfoProvider } from './context/CompanyInfoContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <CompanyInfoProvider>
        <App />
      </CompanyInfoProvider>
    </AuthProvider>
  </StrictMode>,
)
