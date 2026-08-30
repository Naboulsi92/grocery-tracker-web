'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';

interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
}

const ICONS = ['📦', '🥦', '🥛', '🥖', '🍖', '🥫', '🧼', '🧊', '🍪', '🥩', '🐟', '🧀', '🍎', '🍌', '🥕', '🌽'];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState(ICONS[0]);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchCategories();

    const channel = supabase
      .channel('categories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCategories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, router, supabase]);

  async function fetchCategories() {
    const { data: memberData } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user?.id)
      .single();

    if (!memberData?.household_id) {
      router.push('/join-household');
      return;
    }

    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', memberData.household_id)
      .order('order', { ascending: true });

    setCategories(data || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!user || !formName.trim()) return;

    const { data: memberData } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (!memberData?.household_id) return;

    if (editingId) {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ name: formName.trim(), icon: formIcon })
        .eq('id', editingId);

      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order)) : 0;
      
      const { error: insertError } = await supabase
        .from('categories')
        .insert({
          household_id: memberData.household_id,
          name: formName.trim(),
          icon: formIcon,
          order: maxOrder + 1,
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }
    }

    setFormName('');
    setFormIcon(ICONS[0]);
    setShowForm(false);
    setEditingId(null);
    fetchCategories();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette catégorie ?')) return;

    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    fetchCategories();
  }

  function startEdit(category: Category) {
    setFormName(category.name);
    setFormIcon(category.icon);
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
        <div className="loading-container">
          <div className="loading-spinner"></div>
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
            <Link href="/home" className="back-link">
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
          <div className="auth-error" style={{ marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.125rem' }}>
              {editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Nom</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="Ex: Fruits & Légumes"
                />
              </div>
              <div className="form-group">
                <label>Icône</label>
                <div className="icon-picker">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormIcon(icon)}
                      className={`icon-option ${formIcon === icon ? 'selected' : ''}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Enregistrer' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="btn btn-secondary"
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
                  title="Modifier"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="action-btn danger"
                  title="Supprimer"
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

        {categories.length === 0 && !showForm && (
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