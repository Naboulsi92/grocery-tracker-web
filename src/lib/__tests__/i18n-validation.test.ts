import { translate, translateMessage } from '@/lib/i18n';

// Ticket #113 (PRD §4.10) : les messages d'erreur et de validation rendus
// via translate()/translateMessage() existent dans les deux locales
// (parité 380/380 vérifiée) et rendent la bonne langue.
describe('i18n validation and error messages (FR/EN)', () => {
  it('renders validation messages in French and English', () => {
    expect(translate('fr', 'validation.name.too_long')).toBe(
      'Le nom ne doit pas dépasser 50 caractères.',
    );
    expect(translate('en', 'validation.name.too_long')).toBe(
      'The name must not exceed 50 characters.',
    );
    expect(translate('fr', 'validation.name.required_letter')).toContain('lettre');
    expect(translate('en', 'validation.name.required_letter')).toContain('letter');
  });

  it('renders error states in French and English', () => {
    expect(translate('fr', 'error.load_items')).toBe('Impossible de charger les articles.');
    expect(translate('en', 'error.load_items')).toBe('Unable to load items.');
  });

  it('translateMessage resolves keys in the requested language', () => {
    expect(translateMessage('en', 'validation.name.too_long')).toBe(
      'The name must not exceed 50 characters.',
    );
    expect(translateMessage('fr', 'validation.name.too_long')).toBe(
      'Le nom ne doit pas dépasser 50 caractères.',
    );
  });
});
