import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HomePage from '@/app/home/page';

const signOutMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, householdId: 'household-1', signOut: signOutMock }),
}));
jest.mock('@/hooks/useHousehold', () => ({
  useHousehold: () => ({
    household: { id: 'household-1', name: 'Foyer des tests' },
    members: [],
    invitation: { status: 'none' },
    loading: false,
    error: '',
    actions: {
      createInvitation: jest.fn(),
      revokeInvitation: jest.fn(),
      copyInviteCode: jest.fn(),
      refresh: jest.fn(),
    },
  }),
}));
jest.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    permission: 'denied',
    localSubscription: 'unsubscribed',
    serverSync: 'idle',
    operation: 'idle',
    endpoint: null,
    error: null,
    requestPermission: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    isSupported: false,
    isLoading: false,
  }),
}));
jest.mock('@/components/ThemeToggle', () => () => null);
jest.mock('@/components/AuthenticatedHeader', () => ({
  AuthenticatedHeader: function MockAuthenticatedHeader({ trailingAction }: { trailingAction?: React.ReactNode }) {
    return <header>{trailingAction}</header>;
  },
}));
jest.mock('next/link', () => function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href as string} {...props}>{children}</a>;
});

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signOutMock.mockResolvedValue(undefined);
  });

  it('signs out when the user clicks Déconnexion', async () => {
    render(<HomePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Déconnexion' }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
  });
});