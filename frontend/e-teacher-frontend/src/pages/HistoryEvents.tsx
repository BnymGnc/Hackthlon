import { Typography, Paper, Box, List, ListItem, ListItemText } from '@mui/material'

function HistoryEvents() {
  const items = [
    { id: 1, title: 'Quiz oluşturuldu', date: '2025-09-13' },
    { id: 2, title: 'Rapor indirildi', date: '2025-09-14' },
  ]
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Geçmiş Etkinlikler</Typography>
      <Paper sx={{ p: 2 }}>
        <List>
          {items.map(i => (
            <ListItem key={i.id} divider>
              <ListItemText primary={i.title} secondary={i.date} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  )
}

export default HistoryEvents


