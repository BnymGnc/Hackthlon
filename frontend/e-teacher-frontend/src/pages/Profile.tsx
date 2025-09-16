import { useEffect, useState } from 'react'
import { Typography, Paper, Box, TextField, Button, Stack, List, ListItem, ListItemText } from '@mui/material'
import api from '../lib/api'

function Profile() {
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [recent, setRecent] = useState<any[]>([])
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/api/me/profile/')
        setProfile(data)
      } catch {}
      try {
        const { data } = await api.get('/api/assessments/')
        const items = (data || [])
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
        setRecent(items)
      } catch {}
    }
    load()
  }, [])
  async function handleSave() {
    if (!profile) return
    setSaving(true)
    try {
      const { data } = await api.put('/api/me/profile/', { full_name: profile.full_name, bio: profile.bio })
      setProfile(data)
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
    <Box>
      <Typography variant="h5" gutterBottom>Profil</Typography>
      <Paper sx={{ p: 3 }}>
        {profile ? (
          <Stack spacing={2}>
            <TextField label="Kullanıcı Adı" value={profile.username} disabled fullWidth />
            <TextField label="E-posta" value={profile.email} disabled fullWidth />
            <TextField label="Ad Soyad" value={profile.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} fullWidth />
            <TextField label="Biyografi" value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} multiline minRows={3} fullWidth />
            <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">Yükleniyor...</Typography>
        )}
      </Paper>
    </Box>
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>Son Etkinlikler</Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        {recent.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Kayıt bulunamadı</Typography>
        ) : (
          <List>
            {recent.map((r) => (
              <ListItem key={r.id} divider>
                <ListItemText primary={r.title} secondary={new Date(r.created_at).toLocaleString()} />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
    </>
  )
}

export default Profile
