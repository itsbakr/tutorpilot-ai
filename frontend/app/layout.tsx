import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'TutorPilot - AI-Powered Tutoring Platform',
  description: 'Self-Improving AI Tutoring Platform - Create personalized learning strategies, lessons, and interactive activities',
  keywords: ['AI tutoring', 'education', 'personalized learning', 'lesson planning', 'interactive activities'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.cdnfonts.com" />
        <link 
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ToastProvider>
          {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
