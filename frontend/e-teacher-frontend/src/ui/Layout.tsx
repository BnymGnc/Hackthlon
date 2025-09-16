import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Container, Box, IconButton, Button, Menu, MenuItem, Avatar, Tooltip, useTheme, Drawer, List, ListItem, ListItemButton, ListItemText, Divider } from '@mui/material'
import SchoolIcon from '@mui/icons-material/School'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import { useState } from 'react'

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const links = [
    { to: '/dashboard', label: 'Panel' },
    { to: '/career', label: 'Kariyer' },
    { to: '/reports', label: 'Raporlar' },
    { to: '/schedule', label: 'Ders Programı' },
    { to: '/quiz', label: 'Quiz' },
    { to: '/summary', label: 'Özet' },
    { to: '/support', label: 'Destek' },
    { to: '/analysis', label: 'Analiz' },
  ]
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(menuEl)

  return (
    <Box>
      <AppBar position="fixed" color="inherit" elevation={1} sx={{ backdropFilter: 'blur(6px)' }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton edge="start" color="primary" component={Link} to="/dashboard">
              <SchoolIcon />
            </IconButton>
            <Typography variant="h6" component={Link} to="/dashboard" color="inherit" sx={{ textDecoration: 'none' }}>
              E-Teacher
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
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
            <MenuItem component={Link} to="/profile">Profil</MenuItem>
            <MenuItem component={Link} to="/settings">Ayarlar</MenuItem>
            <MenuItem onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); setDrawerOpen(false); handleClose(); navigate('/login') }}>Çıkış Yap</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Outlet />
      </Container>
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 320, p: 2 }} role="presentation">
          <Typography variant="h6" sx={{ mb: 1 }}>Geçmiş</Typography>
          <Typography variant="overline" color="text.secondary">Sohbetler</Typography>
          <List>
            {[{id:1,title:'Matematik çalışma planı'},{id:2,title:'Fizik özet talebi'}].map(item => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton onClick={() => setDrawerOpen(false)}>
                  <ListItemText primary={item.title} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 1 }} />
          <Typography variant="overline" color="text.secondary">Özetler</Typography>
          <List>
            {[{id:10,title:'Biyoloji hücre özeti'},{id:11,title:'Tarih inkılaplar özeti'}].map(item => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton onClick={() => setDrawerOpen(false)}>
                  <ListItemText primary={item.title} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </Box>
  )
}

export default Layout


