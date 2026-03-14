import type { Metadata } from 'next';
import { Box } from '@mui/material';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import ThemeRegistry from '../components/layout/ThemeRegistry';

export const metadata: Metadata = {
  title: 'Inbound 360',
  description: 'AI-powered marketing automation platform by Vervotech',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <Box display="flex" minHeight="100vh" bgcolor="background.default">
            <Sidebar />
            <Box
              flexGrow={1}
              display="flex"
              flexDirection="column"
              overflow="hidden"
              minWidth={0}
            >
              <TopBar />
              <Box
                component="main"
                flexGrow={1}
                p={4}
                overflow="auto"
                sx={{ maxWidth: '100%' }}
              >
                {children}
              </Box>
            </Box>
          </Box>
        </ThemeRegistry>
      </body>
    </html>
  );
}
