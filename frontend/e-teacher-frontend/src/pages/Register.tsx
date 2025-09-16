import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Button, Container, TextField, Typography, Alert, Paper } from '@mui/material'
import api from '../lib/api'

function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== password2) {
      setError('Şifreler eşleşmiyor')
      return
    }
    setLoading(true)
    try {
      const username = email
      await api.post('/api/auth/register/', { username, email, password })
      navigate('/login')
    } catch (err: any) {
      const msg = err?.response?.data?.email || err?.response?.data?.username || err?.response?.data?.detail || 'Kayıt başarısız'
      setError(Array.isArray(msg) ? msg.join(', ') : (typeof msg === 'string' ? msg : 'Kayıt başarısız'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Kayıt Ol
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
          <TextField label="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
          <TextField label="Şifre (Tekrar)" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required fullWidth />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? '...' : 'Kayıt Ol'}
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Zaten hesabın var mı? <Link to="/login">Giriş Yap</Link>
        </Typography>
      </Paper>
    </Container>
  )
}

export default Register


