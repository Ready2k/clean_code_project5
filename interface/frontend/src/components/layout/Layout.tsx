import React from 'react';
import { ResponsiveLayout } from './ResponsiveLayout';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <ResponsiveLayout
      sidebar={<Sidebar />}
      header={<Header />}
      title="Prompt Library Professional Interface"
    >
      {children}
    </ResponsiveLayout>
  );
};