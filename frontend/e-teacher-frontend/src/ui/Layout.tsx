import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Container, Box, IconButton, Button, Menu, MenuItem, Avatar, Tooltip, useTheme, Drawer, List, ListItem, ListItemButton, ListItemText, Divider, Chip } from '@mui/material'
import { useEffect, useState } from 'react'
import api from '../lib/api'
import SchoolIcon from '@mui/icons-material/School'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
// removed duplicate useState import

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [recent, setRecent] = useState<any[]>([])
  useEffect(() => {
    async function loadRecent() {
      try {
        const { data } = await api.get('/api/assessments/')
        const items = (data || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8)
        setRecent(items)
      } catch {}
    }
    if (drawerOpen) loadRecent()
  }, [drawerOpen])
  const links = [
    { to: '/dashboard', label: 'Panel' },
    { to: '/schedule', label: 'Ders Programı Öner' },
    { to: '/quiz', label: 'Quiz Oluştur' },
    { to: '/summary', label: 'Belge Özeti' },
    { to: '/support', label: 'Psikolojik Destek' },
    { to: '/analysis', label: 'Deneme Analizi' },
    { to: '/career', label: 'Kariyer Hedefleri' },
  ]
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(menuEl)

  return (
    <Box>
      <AppBar position="fixed" color="inherit" elevation={1} sx={{ backdropFilter: 'blur(6px)' }}>
        <Toolbar sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', left: 16 }} />
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 1, zIndex: 1 }}>
            <IconButton color="primary" component={Link} to="/dashboard" sx={{ p: 0 }}>
              <SchoolIcon />
            </IconButton>
            <Typography variant="h6" component={Link} to="/dashboard" color="inherit" sx={{ textDecoration: 'none' }}>
              E-Teacher
            </Typography>
          </Box>
          <Box sx={{ mr: 1 }}>
            <Button color="inherit" onClick={(e) => setMenuEl(e.currentTarget)}>Özellikler</Button>
            <Menu anchorEl={menuEl} open={menuOpen} onClose={() => setMenuEl(null)}>
              {links.filter(l => l.to !== '/dashboard').map((l) => (
                <MenuItem key={l.to} component={Link} to={l.to}>{l.label}</MenuItem>
              ))}
            </Menu>
          </Box>
          <Tooltip title={theme.palette.mode === 'dark' ? 'Aydınlık Moda Geç' : 'Karanlık Moda Geç'}>
            <IconButton color="inherit" onClick={() => document.dispatchEvent(new CustomEvent('toggle-color-mode'))} sx={{ mr: 1 }}>
              {theme.palette.mode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Profil">
            <IconButton onClick={handleOpen} size="small" sx={{ ml: 1 }} aria-controls={open ? 'account-menu' : undefined} aria-haspopup="true" aria-expanded={open ? 'true' : undefined}>
              <Avatar sx={{ width: 32, height: 32 }}>U</Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchorEl} id="account-menu" open={open} onClose={handleClose} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
            <MenuItem onClick={() => { setDrawerOpen(true); handleClose() }}>Geçmiş</MenuItem>
            <MenuItem component={Link} to="/saved-schedule">Ders Programı</MenuItem>
            <MenuItem component={Link} to="/daily-report">Günlük Rapor</MenuItem>
            <MenuItem component={Link} to="/profile">Profil</MenuItem>
            <MenuItem component={Link} to="/settings">Ayarlar</MenuItem>
            <MenuItem onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); setDrawerOpen(false); handleClose(); navigate('/login') }}>Çıkış Yap</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Outlet />
      </Container>
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 320, p: 2 }} role="presentation">
          <Typography variant="h6" sx={{ mb: 1 }}>Geçmiş</Typography>
          <List>
            {recent.map((a) => {
              const t = String(a.title || '')
              let type: 'quiz'|'chat'|'support'|'report'|'schedule'|'daily'|'other' = 'other'
              let to = '/dashboard'
              if (/quiz/i.test(t)) { type = 'quiz'; to = '/quiz' }
              else if (/chat/i.test(t)) { type = 'chat'; to = '/chat' }
              else if (/psychsupport|support/i.test(t)) { type = 'support'; to = '/support' }
              else if (/report|rapor/i.test(t)) { type = 'report'; to = '/reports' }
              else if (/schedule|program/i.test(t)) { type = 'schedule'; to = '/schedule' }
              else if (/daily|günlük/i.test(t)) { type = 'daily'; to = '/daily-report' }
              const color = type === 'quiz' ? 'primary' : type === 'chat' ? 'secondary' : type === 'support' ? 'success' : type === 'report' ? 'warning' : type === 'schedule' ? 'info' : type === 'daily' ? 'error' : 'default'
              const label = type === 'quiz' ? 'Quiz' : type === 'chat' ? 'Sohbet' : type === 'support' ? 'Destek' : type === 'report' ? 'Rapor' : type === 'schedule' ? 'Program' : type === 'daily' ? 'Günlük' : 'Diğer'
              return (
                <ListItem key={a.id} disablePadding>
                  <ListItemButton onClick={() => { setDrawerOpen(false); navigate(to) }}>
                    <ListItemText primary={<Box sx={{ display:'flex', alignItems:'center', gap: 1 }}><Chip size="small" label={label} color={color as any} variant="outlined" /> <span>{t}</span></Box>} secondary={new Date(a.created_at).toLocaleString()} />
                  </ListItemButton>
                </ListItem>
              )
            })}
            {recent.length === 0 && (
              <ListItem><ListItemText primary="Kayıt bulunamadı" /></ListItem>
            )}
          </List>
        </Box>
      </Drawer>
    </Box>
  )
}

export default Layout