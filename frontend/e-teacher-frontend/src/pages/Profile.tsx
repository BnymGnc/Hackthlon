import { useEffect, useState, useMemo } from 'react'
import { Typography, Paper, Box, TextField, Button, Stack, List, ListItem, ListItemText, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material'
import { Link } from 'react-router-dom'
import api from '../lib/api'

function Profile() {
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [recent, setRecent] = useState<any[]>([])
  const [latestSchedule, setLatestSchedule] = useState<any | null>(null)
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
      try {
        const { data } = await api.get('/api/ai/schedule/save/')
        setLatestSchedule(data.schedule || null)
      } catch {}
    }
    load()
  }, [])
  const [dailyReports, setDailyReports] = useState<any[]>([])
  useEffect(() => {
    async function loadReports() {
      try {
        const { data } = await api.get('/api/ai/daily-report/list/')
        setDailyReports(Array.isArray(data) ? data : (data.reports || []))
      } catch {}
    }
    loadReports()
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
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <Paper sx={{ p: 3, width: '100%', minHeight: 360, flex: 1 }}>
          {profile ? (
            <Stack spacing={2}>
              <TextField label="Kullanıcı Adı" value={profile.username} disabled fullWidth />
              <TextField label="E-posta" value={profile.email} disabled fullWidth />
              <TextField label="Ad Soyad" value={profile.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} fullWidth />
              <TextField label="Biyografi" value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} multiline minRows={4} fullWidth />
              <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">Yükleniyor...</Typography>
          )}
        </Paper>
        <Paper variant="outlined" sx={{ p: 3, width: '100%', minHeight: 360, flex: 1 }}>
          <Typography variant="h6" gutterBottom>Son Etkinlikler</Typography>
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
      </Stack>
      <Stack sx={{ mt: 2 }}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Günlük Raporlar</Typography>
          {dailyReports.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Henüz günlük rapor yok</Typography>
          ) : (
            <Stack spacing={1.5}>
              {dailyReports.map((r) => (
                <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Chip size="small" label={new Date(r.date || r.created_at).toLocaleDateString('tr-TR')} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Saat: {typeof r.totalHours === 'number' ? r.totalHours.toFixed(1) : (r.total_hours || '-')}h</Typography>
                  <Typography variant="body2">Verimlilik: {r.productivityScore ?? r.productivity ?? '-'}/10</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.notes || r.aiAnalysis || ''}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
    </>
  )
}

export default Profile

function ScheduleTable({ schedule }: { schedule: Array<{ day: string, items: string[] }> }) {
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => 8 + i), [])
  const days = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']
  const cellMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of schedule) {
      for (const it of d.items) {
        const m = it.match(/(\d{2}):00-(\d{2}):00$/)
        if (m) {
          const start = parseInt(m[1])
          const end = parseInt(m[2])
          const course = it.replace(/\s\d{2}:00-\d{2}:00$/, '')
          for (let h = start; h < end; h++) {
            map[`${d.day}-${h}`] = course
          }
        }
      }
    }
    return map
  }, [schedule])

  return (
    <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider', fontWeight: 600 }}>Saat</TableCell>
          {days.map((d, i) => (
            <TableCell key={d} sx={{ borderRight: i < days.length - 1 ? '1px solid' : 'none', borderColor: 'divider', fontWeight: 600 }}>{d}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {hours.map(h => (
          <TableRow key={h}>
            <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>{String(h).padStart(2,'0')}:00</TableCell>
            {days.map((d, i) => (
              <TableCell key={`${d}-${h}`} sx={{ borderRight: i < days.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>{cellMap[`${d}-${h}`] || ''}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
