import { fireEvent, render, screen } from '@testing-library/react';
import SignupPage from '@/app/(auth)/signup/page';

const push = jest.fn();
const replace = jest.fn();
const signUp = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ access: { status: 'signed-out' }, loading: false, signUp }),
}));
jest.mock('@/components/ThemeToggle', () => () => null);

describe('SignupPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects passwords shorter than the configured minimum', () => {
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe', { exact: true }), { target: { value: '1234567' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: '1234567' } });
    fireEvent.submit(screen.getByRole('button', { name: "S'inscrire" }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent('au moins 8 caractères');
    expect(signUp).not.toHaveBeenCalled();
  });
});
