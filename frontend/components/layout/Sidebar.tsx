'use client';

import React from 'react';
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
import WorkIcon from '@mui/icons-material/Work';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import ForumIcon from '@mui/icons-material/Forum';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArticleIcon from '@mui/icons-material/Article';
import SettingsIcon from '@mui/icons-material/Settings';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { usePathname, useRouter } from 'next/navigation';

const DRAWER_WIDTH = 256;

const MAIN_NAV = [
  { label: 'Dashboard', href: '/', icon: <DashboardIcon sx={{ fontSize: 20 }} /> },
  { label: 'Matters', href: '/agents/agent2', icon: <WorkIcon sx={{ fontSize: 20 }} /> },
  { label: 'Matter Boards', href: '/agents/agent3', icon: <DashboardCustomizeIcon sx={{ fontSize: 20 }} /> },
  { label: 'Hangout Social', href: '/agents/agent1', icon: <ForumIcon sx={{ fontSize: 20 }} /> },
  { label: 'Ringside View', href: '/agents/agent4', icon: <VisibilityIcon sx={{ fontSize: 20 }} /> },
  { label: 'Logs', href: '/logs', icon: <ArticleIcon sx={{ fontSize: 20 }} /> },
];

const BOTTOM_NAV = [
  { label: 'Settings', href: '/settings', icon: <SettingsIcon sx={{ fontSize: 20 }} /> },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href);
  };

  const NavItem = ({ label, href, icon }: { label: string; href: string; icon: React.ReactNode }) => {
    const active = isActive(href);
    return (
      <ListItemButton
        onClick={() => router.push(href)}
        sx={{
          borderRadius: '8px',
          mb: 0.25,
          px: 1.5,
          py: 1,
          position: 'relative',
          color: active ? 'primary.main' : 'text.secondary',
          bgcolor: active ? 'rgba(23,84,207,0.08)' : 'transparent',
          borderLeft: active ? '3px solid' : '3px solid transparent',
          borderColor: active ? 'primary.main' : 'transparent',
          '&:hover': {
            bgcolor: 'rgba(23,84,207,0.05)',
            color: 'primary.main',
          },
          transition: 'all 0.15s',
        }}
      >
        <ListItemIcon
          sx={{
            color: 'inherit',
            minWidth: 36,
          }}
        >
          {icon}
        </ListItemIcon>
        <ListItemText
          primary={label}
          primaryTypographyProps={{
            fontSize: 13.5,
            fontWeight: active ? 600 : 500,
            lineHeight: 1.3,
          }}
        />
      </ListItemButton>
    );
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          background: '#ffffff',
          borderRight: '1px solid rgba(23,84,207,0.1)',
          boxShadow: 'none',
        },
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 2.5, pb: 2 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 38,
              height: 38,
              bgcolor: 'primary.main',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {/* Inbound 360 logo — orbit ring + AI core */}
            <svg width="22" height="22" viewBox="0 0 34 34" fill="none">
              <circle cx="17" cy="17" r="10" stroke="white" strokeWidth="2" fill="none"
                strokeDasharray="52 11" strokeLinecap="round" strokeOpacity="0.88"
                transform="rotate(-90 17 17)" />
              <circle cx="17" cy="17" r="6" stroke="white" strokeWidth="1" fill="none" strokeOpacity="0.3" />
              <circle cx="17" cy="7" r="2.2" fill="white" />
              <circle cx="17" cy="17" r="3.8" fill="white" fillOpacity="0.9" />
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: 'text.primary' }}>
              Inbound 360
            </Typography>
            <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Growth Automation
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(23,84,207,0.08)', mx: 2 }} />

      {/* Main Nav */}
      <List sx={{ mt: 1, px: 1.5, flex: 1 }}>
        {MAIN_NAV.map(({ label, href, icon }) => (
          <NavItem key={href} label={label} href={href} icon={icon} />
        ))}
      </List>

      {/* Bottom nav */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Divider sx={{ borderColor: 'rgba(23,84,207,0.08)', mb: 1 }} />
        {BOTTOM_NAV.map(({ label, href, icon }) => (
          <NavItem key={href} label={label} href={href} icon={icon} />
        ))}
      </Box>

      {/* Workspace Section */}
      <Box sx={{ p: 1.5, pt: 0.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            p: 1.25,
            bgcolor: 'rgba(23,84,207,0.05)',
            borderRadius: '10px',
            cursor: 'default',
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: 'rgba(23,84,207,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminPanelSettingsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.primary', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Admin Workspace
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary', lineHeight: 1.3 }}>
              Vervotech · Pro Plan
            </Typography>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
