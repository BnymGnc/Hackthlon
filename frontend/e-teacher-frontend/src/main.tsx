import { StrictMode } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { useMemo, useState, useEffect } from 'react'
import './index.css'
import App from './App.tsx'
import Layout from './ui/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import TargetNets from './pages/TargetNets'
import StudySchedule from './pages/StudySchedule'
import QuizGenerator from './pages/QuizGenerator'
import DocumentSummary from './pages/DocumentSummary'
import PsychologicalSupport from './pages/PsychologicalSupport'
import ExamAnalysis from './pages/ExamAnalysis'
import HistoryEvents from './pages/HistoryEvents'
import Profile from './pages/Profile'
import SavedSchedule from './pages/SavedSchedule'
import Settings from './pages/Settings'
import Chat from './pages/Chat'
import DailyStudyReport from './pages/DailyStudyReport'
import ReportHistory from './pages/ReportHistory'

function requireAuth(element: ReactElement) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  console.log('Token kontrolü:', token)
  return token ? element : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: requireAuth(<Dashboard />) },
      { path: 'dashboard', element: requireAuth(<Dashboard />) },
      { path: 'career', element: requireAuth(<TargetNets />) },
      { path: 'schedule', element: requireAuth(<StudySchedule />) },
      { path: 'quiz', element: requireAuth(<QuizGenerator />) },
      { path: 'summary', element: requireAuth(<DocumentSummary />) },
      { path: 'support', element: requireAuth(<PsychologicalSupport />) },
      { path: 'analysis', element: requireAuth(<ExamAnalysis />) },
      // history/chats removed; use Chat page instead
      { path: 'history/events', element: requireAuth(<HistoryEvents />) },
      { path: 'profile', element: requireAuth(<Profile />) },
      { path: 'saved-schedule', element: requireAuth(<SavedSchedule />) },
      { path: 'settings', element: requireAuth(<Settings />) },
      { path: 'chat', element: requireAuth(<Chat />) },
      { path: 'daily-report', element: requireAuth(<DailyStudyReport />) },
      { path: 'report-history', element: requireAuth(<ReportHistory />) },
    ],
  },
])

function Root() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => (localStorage.getItem('color-mode') as 'light' | 'dark') || 'light')
  useEffect(() => {
    const handler = () => setMode((m) => {
      const next = m === 'light' ? 'dark' : 'light'
      localStorage.setItem('color-mode', next)
      return next
    })
    document.addEventListener('toggle-color-mode', handler as EventListener)
    return () => document.removeEventListener('toggle-color-mode', handler as EventListener)
  }, [])

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#1976d2' },
      secondary: { main: '#9c27b0' },
      background: { default: mode === 'light' ? '#f7f9fc' : '#0f1115' },
    },
    shape: { borderRadius: 12 },
  }), [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)