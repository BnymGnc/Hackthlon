import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Button, Container, TextField, Typography, Alert, Paper } from '@mui/material'
import api from '../lib/api'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/token/', {
        // backend expects username; we map email as username
        username: email,
        password,
      })
      const { access, refresh } = res.data || {}
      if (access && refresh) {
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        console.log('Token alındı ve localStorage\'a kaydedildi:', { access, refresh })
        // Warm-up: ensure profile exists (server creates if missing)
        try {
          await api.get('/api/me/profile/')
        } catch {}
        navigate('/dashboard')
        console.log('Dashboard sayfasına yönlendiriliyor')
      } else {
        setError('Giriş başarısız')
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.error
      setError(detail ? String(detail) : 'Giriş başarısız')
      console.error('Login hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  // If token exists, verify it before redirect to avoid flicker/loops
  useEffect(() => {
    let mounted = true
    async function verifyAndRedirect() {
      const token = localStorage.getItem('access_token')
      if (!token) return
      try {
        await api.get('/api/me/profile/')
        if (!mounted) return
        navigate('/dashboard', { replace: true })
      } catch {
        // invalid/expired token → clear and stay on login
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      }
    }
    verifyAndRedirect()
    return () => { mounted = false }
  }, [navigate])

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Giriş Yap
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
          <TextField label="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? '...' : 'Giriş'}
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Hesabın yok mu? <Link to="/register">Kayıt Ol</Link>
        </Typography>
      </Paper>
    </Container>
  )
}

export default Login


