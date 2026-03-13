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
        <Box display="flex" alignItems="center" gap={1.25} mb={0.5}>
          {/* Custom Inbound 360 Logo — orbit ring + AI core */}
          <svg
            width="34"
            height="34"
            viewBox="0 0 34 34"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0, display: 'block' }}
          >
            <defs>
              <linearGradient id="i360Bg" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" />
                <stop offset="1" stopColor="#0284C7" />
              </linearGradient>
              <linearGradient id="i360Core" x1="10" y1="10" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE68A" />
                <stop offset="1" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            {/* Badge background */}
            <rect width="34" height="34" rx="9" fill="url(#i360Bg)" />
            {/* Outer orbit ring — 300° arc, gap at bottom-left, starts at top */}
            <circle
              cx="17" cy="17" r="10"
              stroke="white"
              strokeWidth="2"
              fill="none"
              strokeDasharray="52 11"
              strokeLinecap="round"
              strokeOpacity="0.88"
              transform="rotate(-90 17 17)"
            />
            {/* Inner orbit ring — subtle accent */}
            <circle
              cx="17" cy="17" r="6"
              stroke="white"
              strokeWidth="1"
              fill="none"
              strokeOpacity="0.25"
            />
            {/* Orbit anchor dot — top, marks the "360" point */}
            <circle cx="17" cy="7" r="2.2" fill="white" />
            {/* AI core — golden centre */}
            <circle cx="17" cy="17" r="3.8" fill="url(#i360Core)" />
            {/* Small highlight on core */}
            <circle cx="15.5" cy="15.5" r="1.2" fill="white" fillOpacity="0.45" />
          </svg>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, lineHeight: 1 }}>
            Inbound 360
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', pl: 0.5 }}>
          AI Marketing Platform
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
