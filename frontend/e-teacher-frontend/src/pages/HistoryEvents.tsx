import { Typography, Paper, Box, List, ListItem, ListItemText, IconButton, Stack, Button } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useEffect, useState } from 'react'
import api from '../lib/api'

function HistoryEvents() {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/api/assessments/')
        const mapped = (data || [])
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map((a: any) => ({ id: a.id, title: a.title, date: new Date(a.created_at).toLocaleString() }))
        setItems(mapped)
      } catch {}
    }
    load()
  }, [])
  async function handleDelete(id: number) {
    try {
      await api.delete(`/api/assessments/${id}/`)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch {}
  }
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Geçmiş Etkinlikler</Typography>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Button size="small" color="error" onClick={async () => {
            try {
              // clear all by deleting one-by-one
              const ids = items.map(i => i.id)
              await Promise.all(ids.map(id => api.delete(`/api/assessments/${id}/`).catch(() => {})))
            } finally {
              setItems([])
            }
          }}>Tümünü Sil</Button>
          <Button size="small" onClick={async () => { try { const { data } = await api.get('/api/assessments/'); const mapped = (data || []).map((a: any) => ({ id: a.id, title: a.title, date: new Date(a.created_at).toLocaleString() })); setItems(mapped) } catch {} }}>Yenile</Button>
        </Stack>
        <List>
          {items.map(i => (
            <ListItem key={i.id} divider secondaryAction={<IconButton edge="end" aria-label="delete" onClick={() => handleDelete(i.id)}><DeleteOutlineIcon /></IconButton>}>
              <ListItemText primary={i.title} secondary={i.date} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  )
}

export default HistoryEvents


