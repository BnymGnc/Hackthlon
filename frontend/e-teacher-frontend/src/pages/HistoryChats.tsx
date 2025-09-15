import { Typography, Paper, Box, List, ListItem, ListItemText } from '@mui/material'

function HistoryChats() {
  const items = [
    { id: 1, title: 'Matematik çalışma planı', date: '2025-09-10' },
    { id: 2, title: 'Fizik özet talebi', date: '2025-09-12' },
  ]
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Geçmiş Sohbetler</Typography>
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

export default HistoryChats


