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
}

interface Unit {
  id: string;
  name: string;
  abbrev: string;
}

interface Item {
  id: string;
  name: string;
  quantity: number;
  unit_id: string;
  category_id: string | null;
  low_stock_threshold: number;
  categories?: Category;
  units?: Unit;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnitId, setFormUnitId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formThreshold, setFormThreshold] = useState('1');
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    if (!user || !supabase) {
      return;
    }
    fetchData();

    const channel = supabase
      .channel('items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, router, supabase]);

  async function fetchData() {
    if (!supabase || !user) return;

    const { data: memberData } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user?.id)
      .single();

    if (!memberData?.household_id) {
      router.push('/join-household');
      return;
    }

    const [categoriesRes, unitsRes, itemsRes] = await Promise.all([
      supabase.from('categories').select('*').eq('household_id', memberData.household_id).order('order'),
      supabase.from('units').select('*'),
      supabase.from('items').select('*, categories(*), units(*)').eq('household_id', memberData.household_id).order('name'),
    ]);

    setCategories(categoriesRes.data || []);
    setUnits(unitsRes.data || []);
    setItems(itemsRes.data || []);
    if (unitsRes.data?.length && !formUnitId) {
      setFormUnitId(unitsRes.data[0].id);
    }
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

    const itemData = {
      name: formName.trim(),
      quantity: parseFloat(formQuantity) || 1,
      unit_id: formUnitId,
      category_id: formCategoryId || null,
      low_stock_threshold: parseFloat(formThreshold) || 1,
      household_id: memberData.household_id,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from('items')
        .update(itemData)
        .eq('id', editingId);

      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from('items').insert(itemData);

      if (insertError) {
        setError(insertError.message);
        return;
      }
    }
    resetForm();
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet article ?')) return;

    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    fetchData();
  }

  async function updateQuantity(id: string, delta: number) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + delta);
    await supabase.from('items').update({ quantity: newQuantity }).eq('id', id);
    fetchData();
  }

  function resetForm() {
    setFormName('');
    setFormQuantity('1');
    setFormCategoryId('');
    setFormThreshold('1');
    setShowForm(false);
    setEditingId(null);
    setError('');
  }

  function startEdit(item: Item) {
    setFormName(item.name);
    setFormQuantity(item.quantity.toString());
    setFormUnitId(item.unit_id);
    setFormCategoryId(item.category_id || '');
    setFormThreshold(item.low_stock_threshold.toString());
    setEditingId(item.id);
    setShowForm(true);
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

  const itemsByCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = { category: cat, items: items.filter(i => i.category_id === cat.id) };
    return acc;
  }, {} as Record<string, { category: Category; items: Item[] }>);

  const uncategorizedItems = items.filter(i => !i.category_id);

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
            <h1>Articles</h1>
          </div>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouveau
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
              {editingId ? 'Modifier l\'article' : 'Nouvel article'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Nom</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="Ex: Pommes" />
              </div>
              <div className="form-group">
                <label>Catégorie</label>
                <select value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)}>
                  <option value="">Aucune</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Quantité</label>
                <input type="number" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} min="0" step="1" />
              </div>
              <div className="form-group">
                <label>Unité</label>
                <select value={formUnitId} onChange={(e) => setFormUnitId(e.target.value)}>
                  {units.map(unit => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Seuil stock bas</label>
                <input type="number" value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)} min="0" step="1" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">{editingId ? 'Enregistrer' : 'Créer'}</button>
                <button type="button" onClick={resetForm} className="btn btn-secondary">Annuler</button>
              </div>
            </form>
          </div>
        )}

        {Object.entries(itemsByCategory).map(([catId, { category, items: catItems }]) => (
          catItems.length > 0 && (
            <div key={catId} style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{category.icon}</span>
                {category.name}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {catItems.map((item, index) => (
                  <ItemRow key={item.id} item={item} index={index} onUpdate={updateQuantity} onEdit={startEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )
        ))}

        {uncategorizedItems.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>Sans catégorie</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {uncategorizedItems.map((item, index) => (
                <ItemRow key={item.id} item={item} index={index} onUpdate={updateQuantity} onEdit={startEdit} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && !showForm && (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <p>Aucun article</p>
            <span>Ajoutez votre premier article</span>
          </div>
        )}
      </main>
    </div>
  );
}

function ItemRow({ item, index, onUpdate, onEdit, onDelete }: { item: Item; index: number; onUpdate: (id: string, delta: number) => void; onEdit: (item: Item) => void; onDelete: (id: string) => void }) {
  const isLowStock = item.quantity <= item.low_stock_threshold;
  
  return (
    <div className={`item-row animate-fade-in ${isLowStock ? 'low-stock' : ''}`} style={{ animationDelay: `${index * 20}ms` }}>
      <div className="item-info">
        <span className="item-name">{item.name}</span>
        {isLowStock && <span className="badge badge-danger">À acheter</span>}
      </div>
      <div className="item-controls">
        <div className="quantity-control">
          <button onClick={() => onUpdate(item.id, -1)} className="qty-btn">−</button>
          <span className="qty-value">{item.quantity} {(item as any).units?.abbrev || ''}</span>
          <button onClick={() => onUpdate(item.id, 1)} className="qty-btn">+</button>
        </div>
        <button onClick={() => onEdit(item)} className="action-btn" title="Modifier">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button onClick={() => onDelete(item.id)} className="action-btn danger" title="Supprimer">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}