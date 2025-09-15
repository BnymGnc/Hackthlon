import { Typography, Paper, Box, TextField, Button, Stack, Drawer, IconButton, List, ListItem, ListItemButton, ListItemText, Divider, Tooltip } from '@mui/material'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon from '@mui/icons-material/Menu'
import { useState } from 'react'

function QuizGenerator() {
  const [drawerOpen, setDrawerOpen] = useState(true)
  const topics = ['Matematik - Türev', 'Fizik - Kinematik', 'Kimya - Asit Baz', 'Tarih - İnkılaplar']
  const histories = ['Quiz #12 - Türev', 'Quiz #11 - Kinematik', 'Quiz #10 - Asit Baz']

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer variant="persistent" anchor="left" open={drawerOpen}>
        <Box sx={{ width: 300, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Quiz Geçmişi</Typography>
            <IconButton onClick={() => setDrawerOpen(false)}><MenuOpenIcon /></IconButton>
          </Box>
          <Typography variant="overline" color="text.secondary">Konu Başlıkları</Typography>
          <List>
            {topics.map(t => (
              <ListItem key={t} disablePadding>
                <ListItemButton>
                  <ListItemText primary={t} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 1 }} />
          <Typography variant="overline" color="text.secondary">Geçmiş Quizler</Typography>
          <List>
            {histories.map(h => (
              <ListItem key={h} disablePadding>
                <ListItemButton>
                  <ListItemText primary={h} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box sx={{ flex: 1, pl: drawerOpen ? 3 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!drawerOpen && (
            <Tooltip title="Geçmişi Aç">
              <IconButton onClick={() => setDrawerOpen(true)}><MenuIcon /></IconButton>
            </Tooltip>
          )}
          <Typography variant="h5" gutterBottom>Quiz Oluşturma</Typography>
        </Box>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="body1">Konu başlıklarını yaz; otomatik quiz soruları üretelim.</Typography>
            <TextField label="Konu Başlıkları" multiline minRows={3} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Soru Sayısı" type="number" inputProps={{ min: 1, max: 50 }} defaultValue={10} />
              <TextField label="Zorluk" select SelectProps={{ native: true }} defaultValue="orta">
                <option value="kolay">Kolay</option>
                <option value="orta">Orta</option>
                <option value="zor">Zor</option>
              </TextField>
            </Stack>
            <Button variant="contained">Quiz Oluştur</Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  )
}

export default QuizGenerator


