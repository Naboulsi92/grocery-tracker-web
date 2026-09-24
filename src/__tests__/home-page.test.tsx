import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HomePage from '@/app/home/page';
import { LanguageProvider } from '@/contexts/LanguageContext';

const signOutMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    householdId: 'household-1',
    signOut: signOutMock,
    retryHousehold: jest.fn(),
    access: { status: 'member', user: { id: 'user-1' }, householdId: 'household-1' },
  }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }) as never,
}));
jest.mock('@/lib/account', () => ({
  fetchProfile: jest.fn().mockResolvedValue({ profile: null, error: null }),
  updateProfileLanguage: jest.fn().mockResolvedValue({ error: null }),
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
      copyText: jest.fn(),
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
    render(
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Déconnexion' }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
  });
});