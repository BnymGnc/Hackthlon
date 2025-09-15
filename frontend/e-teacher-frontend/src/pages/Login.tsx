import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Button, Container, TextField, Typography, Alert, Paper } from '@mui/material'

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
      // TODO: integrate with backend JWT endpoint
      await new Promise((r) => setTimeout(r, 500))
      navigate('/dashboard')
    } catch (err) {
      setError('Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

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


