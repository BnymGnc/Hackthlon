import { StrictMode } from 'react'
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
import CareerRoadmap from './pages/CareerRoadmap'
import StudyReports from './pages/StudyReports'
import StudySchedule from './pages/StudySchedule'
import QuizGenerator from './pages/QuizGenerator'
import DocumentSummary from './pages/DocumentSummary'
import PsychologicalSupport from './pages/PsychologicalSupport'
import ExamAnalysis from './pages/ExamAnalysis'
import HistoryChats from './pages/HistoryChats'
import HistoryEvents from './pages/HistoryEvents'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'career', element: <CareerRoadmap /> },
      { path: 'reports', element: <StudyReports /> },
      { path: 'schedule', element: <StudySchedule /> },
      { path: 'quiz', element: <QuizGenerator /> },
      { path: 'summary', element: <DocumentSummary /> },
      { path: 'support', element: <PsychologicalSupport /> },
      { path: 'analysis', element: <ExamAnalysis /> },
      { path: 'history/chats', element: <HistoryChats /> },
      { path: 'history/events', element: <HistoryEvents /> },
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
