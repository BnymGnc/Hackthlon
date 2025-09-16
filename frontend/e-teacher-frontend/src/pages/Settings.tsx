import React from 'react'
import { Typography, Paper, Box, Stack, Switch, FormControlLabel, Button } from '@mui/material'

function Settings() {
  const notifKey = 'prefs.notifications'
  const [enabled, setEnabled] = React.useState<boolean>(() => {
    const raw = localStorage.getItem(notifKey)
    return raw ? raw === '1' : true
  })
  function handleToggle(_: any, checked: boolean) {
    setEnabled(checked)
    localStorage.setItem(notifKey, checked ? '1' : '0')
  }
  function handleClearHistory() {
    // Frontend-only clear; API deletions are on History pages
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Ayarlar</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <FormControlLabel control={<Switch checked={enabled} onChange={handleToggle} />} label="Bildirimleri Aç" />
          <Button variant="outlined" color="error" onClick={handleClearHistory}>Oturum Jetonlarını Temizle</Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export default Settings


