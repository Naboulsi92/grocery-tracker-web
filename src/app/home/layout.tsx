import { PrivateRoute } from '@/components/PrivateRoute';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PrivateRoute>{children}</PrivateRoute>;
}
