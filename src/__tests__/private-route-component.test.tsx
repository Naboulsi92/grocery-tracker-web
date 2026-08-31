import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrivateRoute } from '@/components/PrivateRoute';
import { useAuth, type PrivateAccess } from '@/contexts/AuthContext';

const replace = jest.fn();
const retryHousehold = jest.fn();
let access: PrivateAccess;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/components/ThemeToggle', () => function ThemeToggle() {
  return <button type="button">Thème</button>;
});

const mockedUseAuth = jest.mocked(useAuth);

describe('PrivateRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    access = { status: 'loading' };
    mockedUseAuth.mockImplementation(() => ({ access, retryHousehold }) as unknown as ReturnType<typeof useAuth>);
  });

  it('announces loading without rendering private content', () => {
    render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    expect(screen.getByRole('status')).toHaveTextContent('Chargement...');
    expect(screen.queryByText('Contenu privé')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects an anonymous user to login', async () => {
    access = { status: 'anonymous' };
    render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('rechecks a missing membership once before redirecting to onboarding', async () => {
    access = { status: 'no-household', user: { id: 'user-1' } as never };
    const view = render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    await waitFor(() => expect(retryHousehold).toHaveBeenCalledTimes(1));
    expect(replace).not.toHaveBeenCalled();

    access = { status: 'loading' };
    view.rerender(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);
    access = { status: 'no-household', user: { id: 'user-1' } as never };
    view.rerender(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/join-household'));
    expect(retryHousehold).toHaveBeenCalledTimes(1);
  });

  it('shows a recoverable error and retries membership resolution', () => {
    access = { status: 'error', user: { id: 'user-1' } as never, error: new Error('hors ligne') };
    render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de vérifier votre foyer. Vous pouvez réessayer.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('hors ligne');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(retryHousehold).toHaveBeenCalledTimes(1);
  });

  it('renders children only for a validated household member', () => {
    access = { status: 'member', user: { id: 'user-1' } as never, householdId: 'home-1' };
    render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    expect(screen.getByText('Contenu privé')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
