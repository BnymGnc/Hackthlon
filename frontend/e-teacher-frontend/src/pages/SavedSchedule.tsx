import { useEffect, useMemo, useState } from 'react'
import { Box, Container, Paper, Stack, Typography, Table, TableHead, TableRow, TableCell, TableBody, Alert } from '@mui/material'
import api from '../lib/api'

function SavedSchedule() {
  const [latestSchedule, setLatestSchedule] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setError(null)
      try {
        const { data } = await api.get('/api/ai/schedule/save/')
        setLatestSchedule(data.schedule || null)
      } catch (e: any) {
        setError('Kaydedilen ders programı yüklenemedi')
      }
    }
    load()
  }, [])

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>Kaydedilen Ders Programı</Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!latestSchedule ? (
          <Typography variant="body2" color="text.secondary">Henüz kaydedilmiş ders programı yok.</Typography>
        ) : (
          <ScheduleTable schedule={latestSchedule.schedule?.schedule || []} />
        )}
      </Paper>
    </Container>
  )
}

export default SavedSchedule

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
            <TableCell sx={{ fontWeight: 600, borderRight: '1px solid', borderColor: 'divider' }}>{String(h).padStart(2,'0')}:00</TableCell>
            {days.map((d, i) => (
              <TableCell key={`${d}-${h}`} sx={{ borderRight: i < days.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>{cellMap[`${d}-${h}`] || ''}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}


