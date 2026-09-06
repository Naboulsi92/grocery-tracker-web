import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrivateRoute } from '@/components/PrivateRoute';
import { useAuth, type PrivateAccess, type User } from '@/contexts/AuthContext';

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

const testUser = { id: 'user-1' } as User;

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
    access = { status: 'no-household', user: testUser };
    const view = render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    await waitFor(() => expect(retryHousehold).toHaveBeenCalledTimes(1));
    expect(replace).not.toHaveBeenCalled();

    access = { status: 'loading' };
    view.rerender(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);
    access = { status: 'no-household', user: testUser };
    view.rerender(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/join-household'));
    expect(retryHousehold).toHaveBeenCalledTimes(1);
  });

  it('shows a recoverable error and retries membership resolution', () => {
    access = { status: 'error', user: testUser, error: new Error('hors ligne') };
    render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de vérifier votre foyer. Vous pouvez réessayer.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('hors ligne');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(retryHousehold).toHaveBeenCalledTimes(1);
  });

  it('renders children only for a validated household member', () => {
    access = { status: 'member', user: testUser, householdId: 'home-1' };
    render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    expect(screen.getByText('Contenu privé')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps children mounted during background re-resolution (member -> loading -> member)', () => {
    access = { status: 'member', user: testUser, householdId: 'home-1' };
    const view = render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    expect(screen.getByText('Contenu privé')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Simulate background re-resolution: access becomes loading
    access = { status: 'loading' };
    view.rerender(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    // Children should stay mounted
    expect(screen.getByText('Contenu privé')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Access resolves back to member
    access = { status: 'member', user: testUser, householdId: 'home-1' };
    view.rerender(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    expect(screen.getByText('Contenu privé')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows loading on initial load before any member access', () => {
    access = { status: 'loading' };
    render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    expect(screen.getByRole('status')).toHaveTextContent('Chargement...');
    expect(screen.queryByText('Contenu privé')).not.toBeInTheDocument();
  });

  it('unmounts children when background re-resolution results in no-household', () => {
    access = { status: 'member', user: testUser, householdId: 'home-1' };
    const view = render(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    expect(screen.getByText('Contenu privé')).toBeVisible();

    // Simulate background re-resolution resulting in no-household
    access = { status: 'loading' };
    view.rerender(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    access = { status: 'no-household', user: testUser };
    view.rerender(<PrivateRoute><p>Contenu privé</p></PrivateRoute>);

    // Children should be unmounted, loading/error shown
    expect(screen.queryByText('Contenu privé')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});