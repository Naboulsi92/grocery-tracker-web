'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useEffectEvent, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { getErrorMessage, groupItems, joinInventory, type Category, type InventoryItem, type Unit } from '@/lib/inventory';

export default function ItemsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
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
  const [mutating, setMutating] = useState<string | null>(null);
  const { householdId } = useAuth();
  const [supabase] = useState(createClient);
  const requestId = useRef(0);

  const fetchData = useCallback(async (showLoading = false) => {
    if (!householdId) return;
    const currentRequest = ++requestId.current;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const [categoriesRes, unitsRes, itemsRes] = await Promise.all([
        supabase.from('categories').select('*').eq('household_id', householdId).order('order'),
        supabase.from('units').select('*').order('name'),
        supabase.from('items').select('*').eq('household_id', householdId).order('name'),
      ]);
      const queryError = categoriesRes.error ?? unitsRes.error ?? itemsRes.error;
      if (queryError) throw queryError;
      if (currentRequest !== requestId.current) return;

      const nextCategories = categoriesRes.data ?? [];
      const nextUnits = unitsRes.data ?? [];
      setCategories(nextCategories);
      setUnits(nextUnits);
      setItems(joinInventory(itemsRes.data ?? [], nextCategories, nextUnits));
      setFormUnitId((current) => current || nextUnits[0]?.id || '');
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(getErrorMessage(loadError, 'Impossible de charger les articles.'));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [householdId, supabase]);
  const loadData = useEffectEvent(fetchData);

  useEffect(() => {
    if (!householdId) return;
    queueMicrotask(() => void loadData(true));

    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`items:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void loadData(), 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void loadData(), 300);
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

    if (!householdId || !formName.trim() || !formUnitId || mutating) return;
    setMutating('form');

    const editableItemData = {
      name: formName.trim(),
      unit_id: formUnitId,
      category_id: formCategoryId || null,
      low_stock_threshold: parseFloat(formThreshold) || 1,
    };

    try {
      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('items')
          .update(editableItemData)
          .eq('id', editingId)
          .eq('household_id', householdId)
          .select()
          .single();
        if (updateError) throw updateError;
        setItems((current) => current.map((item) => item.id === data.id
          ? joinInventory([data], categories, units)[0]
          : item));
      } else {
        const itemData = {
          ...editableItemData,
          quantity: parseFloat(formQuantity) || 1,
          household_id: householdId,
        };
        const { data, error: insertError } = await supabase.from('items').insert(itemData).select().single();
        if (insertError) throw insertError;
        setItems((current) => [...current, joinInventory([data], categories, units)[0]]
          .sort((left, right) => left.name.localeCompare(right.name)));
      }
      resetForm();
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'Impossible d’enregistrer l’article.'));
    } finally {
      setMutating(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet article ?')) return;

    if (!householdId || mutating) return;
    setMutating(id);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('items')
        .delete()
        .eq('id', id)
        .eq('household_id', householdId)
        .select('id')
        .single();
      if (deleteError) throw deleteError;
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'Impossible de supprimer l’article.'));
    } finally {
      setMutating(null);
    }
  }

  async function updateQuantity(id: string, delta: number) {
    if (mutating) return;
    setMutating(id);
    setError('');
    try {
      const { data, error: quantityError } = await supabase.rpc('adjust_item_quantity', {
        p_item_id: id,
        p_delta: delta,
      });
      if (quantityError) throw quantityError;
      if (data.household_id !== householdId) throw new Error('Article hors du foyer courant.');
      setItems((current) => current.map((item) => item.id === id ? { ...item, ...data } : item));
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'Impossible de modifier la quantité.'));
    } finally {
      setMutating(null);
    }
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

  function startEdit(item: InventoryItem) {
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
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  const itemGroups = groupItems(items, categories);

  return (
    <div className="page-container">
      <ThemeToggle />
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <Link href="/home" className="back-link" aria-label="Retour à l’accueil">
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
          <div className="auth-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
            <button type="button" className="btn btn-secondary" onClick={() => void fetchData(true)}>Réessayer</button>
          </div>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.125rem' }}>
              {editingId ? 'Modifier l\'article' : 'Nouvel article'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="item-name">Nom</label>
                <input id="item-name" type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="Ex: Pommes" />
              </div>
              <div className="form-group">
                <label htmlFor="item-category">Catégorie</label>
                <select id="item-category" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)}>
                  <option value="">Aucune</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="item-quantity">Quantité</label>
                <input id="item-quantity" type="number" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} min="0" step="1" />
              </div>
              <div className="form-group">
                <label htmlFor="item-unit">Unité</label>
                <select id="item-unit" value={formUnitId} onChange={(e) => setFormUnitId(e.target.value)} required>
                  {units.map(unit => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="item-threshold">Seuil stock bas</label>
                <input id="item-threshold" type="number" value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)} min="0" step="1" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={mutating === 'form'}>{editingId ? 'Enregistrer' : 'Créer'}</button>
                <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={mutating === 'form'}>Annuler</button>
              </div>
            </form>
          </div>
        )}

        {itemGroups.map(({ category, items: groupedItems }) => (
            <div key={category?.id ?? 'uncategorized'} style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {category ? <><span style={{ fontSize: '1.25rem' }}>{category.icon ?? '📦'}</span>{category.name}</> : 'Sans catégorie'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {groupedItems.map((item, index) => (
                  <ItemRow key={item.id} item={item} index={index} disabled={mutating !== null} onUpdate={updateQuantity} onEdit={startEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
        ))}

        {items.length === 0 && !showForm && !error && (
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

function ItemRow({ item, index, disabled, onUpdate, onEdit, onDelete }: { item: InventoryItem; index: number; disabled: boolean; onUpdate: (id: string, delta: number) => void; onEdit: (item: InventoryItem) => void; onDelete: (id: string) => void }) {
  const isLowStock = item.quantity <= item.low_stock_threshold;
  
  return (
    <div className={`item-row animate-fade-in ${isLowStock ? 'low-stock' : ''}`} style={{ animationDelay: `${index * 20}ms` }}>
      <div className="item-info">
        <span className="item-name">{item.name}</span>
        {isLowStock && <span className="badge badge-danger">À acheter</span>}
      </div>
      <div className="item-controls">
        <div className="quantity-control">
          <button onClick={() => onUpdate(item.id, -1)} className="qty-btn" disabled={disabled || item.quantity <= 0} aria-label={`Réduire la quantité de ${item.name}`}>−</button>
          <span className="qty-value" aria-live="polite">{item.quantity} {item.unit?.abbrev || ''}</span>
          <button onClick={() => onUpdate(item.id, 1)} className="qty-btn" disabled={disabled} aria-label={`Augmenter la quantité de ${item.name}`}>+</button>
        </div>
        <button onClick={() => onEdit(item)} className="action-btn" disabled={disabled} aria-label={`Modifier l’article ${item.name}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button onClick={() => onDelete(item.id)} className="action-btn danger" disabled={disabled} aria-label={`Supprimer l’article ${item.name}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
