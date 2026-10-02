import './globals.css';

export const metadata = { title: 'Looma', description: 'Your personal AI workspace and desktop companion.' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="looma-theme" suppressHydrationWarning={true}>
      <body className="bg-background text-foreground antialiased select-none" suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
