import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrightModHub — Twitch Bot Detection',
  description: 'Real-time bot detection dashboard for Twitch moderators. Identify auto-typers, reward snipers, and macro users with behavioral analysis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body className="bg-bright-bg text-bright-text antialiased">
        {children}
      </body>
    </html>
  );
}
