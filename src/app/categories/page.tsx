'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useEffectEvent, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { getErrorMessage, getNextCategoryOrder, type Category } from '@/lib/inventory';

const ICONS = ['📦', '🥦', '🥛', '🥖', '🍖', '🥫', '🧼', '🧊', '🍪', '🥩', '🐟', '🧀', '🍎', '🍌', '🥕', '🌽'];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState(ICONS[0]);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState<string | null>(null);
  const { householdId } = useAuth();
  const [supabase] = useState(createClient);
  const requestId = useRef(0);

  const fetchCategories = useCallback(async (showLoading = false) => {
    if (!householdId) return;
    const currentRequest = ++requestId.current;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const { data, error: loadError } = await supabase
        .from('categories')
        .select('*')
        .eq('household_id', householdId)
        .order('order', { ascending: true });
      if (loadError) throw loadError;
      if (currentRequest === requestId.current) setCategories(data ?? []);
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(getErrorMessage(loadError, 'Impossible de charger les catégories.'));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [householdId, supabase]);
  const loadCategories = useEffectEvent(fetchCategories);

  useEffect(() => {
    if (!householdId) return;

    queueMicrotask(() => void loadCategories(true));

    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`categories:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void loadCategories(), 300);
      })
      .subscribe();

    return () => {
      requestId.current += 1;
      clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [householdId, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!householdId || !formName.trim() || mutating) return;
    setMutating('form');

    try {
      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('categories')
          .update({ name: formName.trim(), icon: formIcon })
          .eq('id', editingId)
          .eq('household_id', householdId)
          .select()
          .single();
        if (updateError) throw updateError;
        setCategories((current) => current.map((category) => category.id === data.id ? data : category));
      } else {
        const { data, error: insertError } = await supabase
          .from('categories')
          .insert({
            household_id: householdId,
            name: formName.trim(),
            icon: formIcon,
            order: getNextCategoryOrder(categories),
          })
          .select()
          .single();
        if (insertError) throw insertError;
        setCategories((current) => [...current, data]);
      }
      cancelForm();
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'Impossible d’enregistrer la catégorie.'));
    } finally {
      setMutating(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette catégorie ?')) return;
    if (!householdId || mutating) return;
    setMutating(id);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('household_id', householdId)
        .select('id')
        .single();
      if (deleteError) throw deleteError;
      setCategories((current) => current.filter((category) => category.id !== id));
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'Impossible de supprimer la catégorie.'));
    } finally {
      setMutating(null);
    }
  }

  function startEdit(category: Category) {
    setFormName(category.name);
    setFormIcon(category.icon ?? ICONS[0]);
    setEditingId(category.id);
    setShowForm(true);
  }

  function cancelForm() {
    setFormName('');
    setFormIcon(ICONS[0]);
    setShowForm(false);
    setEditingId(null);
    setError('');
  }

  if (loading) {
    return (
      <div className="page-container">
        <ThemeToggle />
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <ThemeToggle />
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <Link href="/home" className="back-link" aria-label="Retour à l’accueil" data-testid="back-link">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </Link>
            <h1>Catégories</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
            data-testid="btn-new-category"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouvelle
          </button>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
            <button type="button" className="btn btn-secondary" onClick={() => void fetchCategories(true)}>Réessayer</button>
          </div>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.125rem' }}>
              {editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label htmlFor="category-name">Nom</label>
                <input
                  id="category-name"
                  type="text"
                  data-testid="input-category-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="Ex: Fruits & Légumes"
                />
              </div>
              <div className="form-group">
                <span id="category-icon-label">Icône</span>
                <div className="icon-picker" role="group" aria-labelledby="category-icon-label">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormIcon(icon)}
                      className={`icon-option ${formIcon === icon ? 'selected' : ''}`}
                      aria-label={`Choisir l’icône ${icon}`}
                      aria-pressed={formIcon === icon}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" disabled={mutating === 'form'} data-testid="btn-create-category">
                  {editingId ? 'Enregistrer' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="btn btn-secondary"
                  disabled={mutating === 'form'}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="categories-grid">
          {categories.map((category, index) => (
            <div
              key={category.id}
              className="category-card animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="category-info">
                <span className="category-icon">{category.icon}</span>
                <span className="category-name">{category.name}</span>
              </div>
              <div className="category-actions">
                <button
                  onClick={() => startEdit(category)}
                  className="action-btn"
                  disabled={mutating !== null}
                  aria-label={`Modifier la catégorie ${category.name}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="action-btn danger"
                  disabled={mutating !== null}
                  aria-label={`Supprimer la catégorie ${category.name}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {categories.length === 0 && !showForm && !error && (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <p>Aucune catégorie</p>
            <span>Créez-en une pour commencer</span>
          </div>
        )}
      </main>
    </div>
  );
}
