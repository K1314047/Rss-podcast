import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Listen Now',
  description: '把更新留给 RSS，把注意力留给声音'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
