import { render, screen, fireEvent } from '@testing-library/react';
import { FAQ } from '@/components/marketing/FAQ';
import { LanguageProvider } from '@/contexts/LanguageContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({}) as never,
}));

function renderWithLanguage(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe('FAQ', () => {
  it('renders section title', () => {
    renderWithLanguage(<FAQ />);
    expect(screen.getByText('Questions fréquentes')).toBeInTheDocument();
  });

  it('renders all 5 FAQ questions', () => {
    renderWithLanguage(<FAQ />);
    expect(screen.getByText('Est-ce gratuit ?')).toBeInTheDocument();
    expect(screen.getByText('Combien de personnes peuvent rejoindre mon foyer ?')).toBeInTheDocument();
    expect(screen.getByText('Dois-je télécharger une application ?')).toBeInTheDocument();
    expect(screen.getByText('Puis-je partager uniquement certains articles ?')).toBeInTheDocument();
    expect(screen.getByText('Mes données sont-elles sécurisées ?')).toBeInTheDocument();
  });

  it('answers are collapsed by default', () => {
    renderWithLanguage(<FAQ />);
    expect(screen.queryByText("Oui ! Nos fonctionnalités principales sont entièrement gratuites pour les foyers de toute taille.")).not.toBeInTheDocument();
  });

  it('expands answer when clicking question', () => {
    renderWithLanguage(<FAQ />);
    const question = screen.getByText('Est-ce gratuit ?');
    fireEvent.click(question);
    expect(screen.getByText("Oui ! Nos fonctionnalités principales sont entièrement gratuites pour les foyers de toute taille.")).toBeInTheDocument();
  });

  it('collapses answer when clicking again', () => {
    renderWithLanguage(<FAQ />);
    const question = screen.getByText('Est-ce gratuit ?');
    fireEvent.click(question);
    expect(screen.getByText("Oui ! Nos fonctionnalités principales sont entièrement gratuites pour les foyers de toute taille.")).toBeInTheDocument();
    fireEvent.click(question);
    expect(screen.queryByText("Oui ! Nos fonctionnalités principales sont entièrement gratuites pour les foyers de toute taille.")).not.toBeInTheDocument();
  });

  it('only one answer open at a time', () => {
    renderWithLanguage(<FAQ />);
    const questions = screen.getAllByRole('button');
    
    fireEvent.click(questions[0]);
    expect(screen.getByText("Oui ! Nos fonctionnalités principales sont entièrement gratuites pour les foyers de toute taille.")).toBeInTheDocument();
    
    fireEvent.click(questions[1]);
    expect(screen.queryByText("Oui ! Nos fonctionnalités principales sont entièrement gratuites pour les foyers de toute taille.")).not.toBeInTheDocument();
    expect(screen.getByText('Illimité ! Ajoutez tous les membres de la famille, colocataires ou partenaires.')).toBeInTheDocument();
  });

  it('has proper touch target size via mk-faq-q', () => {
    renderWithLanguage(<FAQ />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button.className).toContain('mk-faq-q');
    });
  });
});
