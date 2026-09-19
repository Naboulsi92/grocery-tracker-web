import { PrivateRoute } from '@/components/PrivateRoute';

export default function SettingsNotificationsLayout({ children }: { children: React.ReactNode }) {
  return <PrivateRoute>{children}</PrivateRoute>;
}