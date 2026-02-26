'use client';

import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ArticleIcon from '@mui/icons-material/Article';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { usePathname, useRouter } from 'next/navigation';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: <DashboardIcon /> },
  { label: 'Agents', href: '/agents', icon: <SmartToyIcon /> },
  { label: 'Logs', href: '/logs', icon: <ArticleIcon /> },
  { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #1565C0 0%, #0D47A1 100%)',
          color: 'white',
          border: 'none',
        },
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 3, pb: 2 }}>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <AutoAwesomeIcon sx={{ color: '#FFD54F', fontSize: 22 }} />
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, lineHeight: 1 }}>
            MA Platform
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', pl: 0.5 }}>
          Marketing Automation AI
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 2 }} />

      <List sx={{ mt: 1, px: 1 }}>
        {NAV_ITEMS.map(({ label, href, icon }) => (
          <ListItemButton
            key={href}
            selected={isActive(href)}
            onClick={() => router.push(href)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              color: 'rgba(255,255,255,0.8)',
              '&.Mui-selected': {
                backgroundColor: 'rgba(255,255,255,0.18)',
                color: 'white',
                '& .MuiListItemIcon-root': { color: 'white' },
              },
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'white',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 40 }}>
              {icon}
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
            />
          </ListItemButton>
        ))}
      </List>

      {/* Footer */}
      <Box sx={{ mt: 'auto', p: 2.5 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
          Powered by Vervotech
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
          v1.0.0 — Hackathon 2026
        </Typography>
      </Box>
    </Drawer>
  );
}
