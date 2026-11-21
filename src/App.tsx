import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { ToastProvider } from './components/ui/Toast'
import { RESTAURANT } from './config'
import { LoginPage } from './pages/LoginPage'
import { useAuthStore } from './store/useAuthStore'

function SplashScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <p className="text-lg font-extrabold text-primary">{RESTAURANT.name}</p>
    </div>
  )
}

function AppContent() {
  const status = useAuthStore((state) => state.status)
  const refresh = useAuthStore((state) => state.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (status === 'checking') return <SplashScreen />
  if (status === 'anonymous') return <LoginPage />
  return <RouterProvider router={router} />
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
