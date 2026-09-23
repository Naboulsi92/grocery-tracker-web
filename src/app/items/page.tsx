'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useEffectEvent, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SyncingIndicator } from '@/components/SyncingIndicator';
import { getErrorMessage, groupItems, joinInventory, CATEGORY_COLUMNS, ITEM_COLUMNS, type Category, type InventoryItem } from '@/lib/inventory';
import { createItem, updateItem, updateItemQuantity, deleteItem } from '@/lib/itemOperations';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { AccessibleDialog } from '@/components/AccessibleDialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useResyncOnReconnect } from '@/hooks/useResyncOnReconnect';
import { validateName, validateQuantity, validateThreshold, validateUnit } from '@/lib/validation';
import { translateMessage } from '@/lib/i18n';
import { UNITS, getUnitStep, isUnit, type Unit } from '@/types/units';

export default function ItemsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnit, setFormUnit] = useState<Unit>('unite');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formThreshold, setFormThreshold] = useState('1');
  const [error, setError] = useState('');
  const [fieldNameError, setFieldNameError] = useState('');
  const [fieldQuantityError, setFieldQuantityError] = useState('');
  const [fieldThresholdError, setFieldThresholdError] = useState('');
  const [fieldUnitError, setFieldUnitError] = useState('');
  const [mutating, setMutating] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { householdId } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { t, language } = useI18n();
  const { household, loading: householdLoading, error: householdError } = useHousehold(householdId ?? '');
  const isLoading = loading || householdLoading;
  const combinedError = householdError || error;
  const [supabase] = useState(createClient);
  const requestId = useRef(0);

  const fetchData = useCallback(async (showLoading = false) => {
    if (!householdId) return;
    const currentRequest = ++requestId.current;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        // Ticket #117 : colonnes explicites (Row complet, pas de '*').
        // Inventaire SANS pagination (décision ticket) : tri conservé.
        supabase.from('categories').select(CATEGORY_COLUMNS).eq('household_id', householdId).order('name'),
        supabase.from('items').select(ITEM_COLUMNS).eq('household_id', householdId).order('name'),
      ]);
      const queryError = categoriesRes.error ?? itemsRes.error;
      if (queryError) throw queryError;
      if (currentRequest !== requestId.current) return;

      const nextCategories = categoriesRes.data ?? [];
      setCategories(nextCategories);
      setItems(joinInventory(itemsRes.data ?? [], nextCategories));
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(getErrorMessage(loadError, 'error.load_items'));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [householdId, supabase]);
  const loadData = useEffectEvent(fetchData);

  // Resync background silencieuse à la reconnexion (PRD §4.12 + §5).
  useResyncOnReconnect(fetchData);

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
  setFieldNameError('');
  setFieldQuantityError('');
  setFieldThresholdError('');
  setFieldUnitError('');

  if (!householdId || !formUnit || mutating || !isOnline) return;

  // A displayed unit error blocks submit even though the last valid unit
  // state would pass validation (tampered select value: the error is set
  // from the DOM value while formUnit keeps the previous valid one).
  if (fieldUnitError) return;

  const unitErr = validateUnit(formUnit);
  if (unitErr) { setFieldUnitError(unitErr); return; }

  const nameErr = validateName(formName);
  if (nameErr) { setFieldNameError(nameErr); return; }

  const duplicateItem = items.some(
    (item) => item.id !== editingId && item.name.trim().toLowerCase() === formName.trim().toLowerCase(),
  );
  if (duplicateItem) { setFieldNameError('items.duplicate'); return; }

  if (!editingId) {
    const qtyErr = validateQuantity(formQuantity);
    if (qtyErr) { setFieldQuantityError(qtyErr); return; }
  }

  const thresholdVal = parseInt(formThreshold, 10);
  const thresholdErr = validateThreshold(thresholdVal);
  if (thresholdErr) { setFieldThresholdError(thresholdErr); return; }

  setMutating('form');

  const editableItemData = {
    name: formName.trim(),
    unit: formUnit,
    category_id: formCategoryId || null,
    low_stock_threshold: thresholdVal,
  };

    try {
      if (editingId) {
        const { error } = await updateItem(editingId, householdId!, editableItemData);
        if (error) throw error;
        await fetchData();
      } else {
        // Empty stays 1 (historical default); a literal 0 is a valid quantity
        // (out of stock) and must survive — `parseInt(...) || 1` swallowed it.
        const { error } = await createItem(householdId, {
          ...editableItemData,
          quantity: formQuantity.trim() === '' ? 1 : parseInt(formQuantity, 10),
        });
        if (error) throw error;
        await fetchData();
      }
      resetForm();
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'error.save_item'));
    } finally {
      setMutating(null);
    }
  }

  async function handleDelete(id: string) {
    if (!householdId || mutating || !isOnline) return;
    setMutating(id);
    setError('');
    try {
      const { error } = await deleteItem(id, householdId!);
      if (error) throw error;
      // Local mutation applied below: invalidate in-flight fetches so a stale
      // response cannot resurrect the deleted row.
      requestId.current += 1;
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'error.delete_item'));
    } finally {
      setMutating(null);
    }
  }

  async function updateQuantity(id: string, delta: number) {
    if (mutating || !isOnline) return;
    setMutating(id);
    setError('');
    try {
      const { error } = await updateItemQuantity(id, delta);
      if (error) throw error;
      await fetchData();
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'error.save_quantity'));
    } finally {
      setMutating(null);
    }
  }

  function resetForm() {
    setFormName('');
    setFormQuantity('1');
    setFormUnit('unite');
    setFormCategoryId('');
    setFormThreshold('1');
    setShowForm(false);
    setEditingId(null);
    setError('');
    setFieldNameError('');
    setFieldQuantityError('');
    setFieldThresholdError('');
    setFieldUnitError('');
  }

  function startEdit(item: InventoryItem) {
    setFormName(item.name);
    setFormQuantity(item.quantity.toString());
    setFormUnit(isUnit(item.unit) ? item.unit : 'unite');
    setFormCategoryId(item.category_id || '');
    setFormThreshold(item.low_stock_threshold.toString());
    setEditingId(item.id);
    setShowForm(true);
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <OfflineBanner />
        <ThemeToggle />
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const itemGroups = groupItems(items, categories);

return (
    <div className="page-container">
      <OfflineBanner />
      <AuthenticatedHeader showBackLink household={household} loading={householdLoading} error={householdError} />
      <SyncingIndicator />

      <main className="app-main" id="main">
        <h1>{t('items.title')}</h1>

        {combinedError && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {translateMessage(language, combinedError)}
            <button type="button" className="btn btn-secondary" onClick={() => void fetchData(true)} data-testid="btn-retry-items">{t('common.retry')}</button>
          </div>
        )}

        {items.length > 0 && !showForm && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginBottom: '1.5rem' }}
            onClick={() => setShowForm(true)}
            disabled={!isOnline}
            data-testid="btn-new-item"
          >
            {t('items.new')}
          </button>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.125rem' }}>
              {editingId ? t('items.edit_title') : t('items.new')}
            </h2>
            <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="item-name">{t('items.name')}</label>
                 <input id="item-name" type="text" data-testid="input-item-name" value={formName} onChange={(e) => { setFormName(e.target.value); setFieldNameError(''); }} required placeholder={t('items.name_placeholder')} aria-invalid={!!fieldNameError} aria-describedby={fieldNameError ? 'item-name-error' : undefined} />
                {fieldNameError && <p className="field-error" role="alert" id="item-name-error" data-testid={fieldNameError === 'items.duplicate' ? 'error-name-duplicate' : fieldNameError === 'validation.name.too_long' ? 'error-name-too-long' : 'error-name-required-letter'}>{translateMessage(language, fieldNameError)}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="item-category">{t('items.category')}</label>
                <select id="item-category" data-testid="input-item-category" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)}>
                  <option value="">{t('items.category_none')}</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="item-quantity">{t('items.quantity')}</label>
                <input id="item-quantity" type="number" data-testid="input-item-quantity" value={formQuantity} onChange={(e) => { setFormQuantity(e.target.value); setFieldQuantityError(''); }} min="0" step={getUnitStep(formUnit)} aria-invalid={!!fieldQuantityError} aria-describedby={fieldQuantityError ? 'item-quantity-error' : undefined} />
                {fieldQuantityError && <p className="field-error" role="alert" id="item-quantity-error" data-testid="error-quantity-negative">{translateMessage(language, fieldQuantityError)}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="item-unit">{t('items.unit')}</label>
                <select id="item-unit" data-testid="input-item-unit" value={formUnit} onChange={(e) => {
                  const nextUnit = e.target.value;
                  if (!isUnit(nextUnit)) {
                    setFieldUnitError('validation.unit.invalid');
                    return;
                  }
                  if (nextUnit !== formUnit) {
                    setFormQuantity('');
                    setFormThreshold('');
                    setFieldQuantityError('');
                    setFieldThresholdError('');
                    setFieldUnitError('');
                  }
                  setFormUnit(nextUnit);
                }} required aria-invalid={!!fieldUnitError} aria-describedby={fieldUnitError ? 'item-unit-error' : undefined}>
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>{t(`items.unit_${unit}`)}</option>
                  ))}
                </select>
                {fieldUnitError && <p className="field-error" role="alert" id="item-unit-error" data-testid="error-unit-invalid">{translateMessage(language, fieldUnitError)}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="item-threshold">{t('items.threshold')}</label>
                <input id="item-threshold" type="number" data-testid="input-item-threshold" value={formThreshold} onChange={(e) => { setFormThreshold(e.target.value); setFieldThresholdError(''); }} min="1" step={getUnitStep(formUnit)} aria-invalid={!!fieldThresholdError} aria-describedby={fieldThresholdError ? 'item-threshold-error' : undefined} />
                {fieldThresholdError && <p className="field-error" role="alert" id="item-threshold-error" data-testid="error-threshold-required">{translateMessage(language, fieldThresholdError)}</p>}
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={mutating === 'form' || !isOnline || !householdId} data-testid="btn-create-item">{editingId ? t('common.save') : t('common.create')}</button>
                <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={mutating === 'form'} data-testid="btn-cancel-item">{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        )}

        {deleteTarget && (
          <AccessibleDialog
            title={items.find((item) => item.id === deleteTarget)?.name ?? ''}
            message={t('items.delete_confirm')}
            confirmLabel={t('common.confirm')}
            cancelLabel={t('common.cancel')}
            confirmTestId="item-delete-confirm"
            cancelTestId="item-delete-cancel"
            dialogTestId="item-delete-dialog"
            onConfirm={() => {
              const id = deleteTarget;
              setDeleteTarget(null);
              void handleDelete(id);
            }}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
        {itemGroups.map(({ category, items: groupedItems }) => (
            <div key={category?.id ?? 'uncategorized'} style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {category ? <><span style={{ fontSize: '1.25rem' }}>📦</span>{category.name}</> : t('items.uncategorized')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {groupedItems.map((item, index) => (
                  <ItemRow key={item.id} item={item} index={index} disabled={mutating !== null || !isOnline} onUpdate={updateQuantity} onEdit={startEdit} onDelete={(id: string) => setDeleteTarget(id)} t={t} />
                ))}
              </div>
            </div>
        ))}

        {items.length === 0 && !showForm && !error && (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-state-icon">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <p>{t('items.empty_title')}</p>
            <span>{t('items.empty_sub')}</span>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => setShowForm(true)}
              disabled={!isOnline}
              data-testid="btn-new-item"
            >
              {t('items.new')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function ItemRow({ item, index, disabled, onUpdate, onEdit, onDelete, t }: { item: InventoryItem; index: number; disabled: boolean; onUpdate: (id: string, delta: number) => void; onEdit: (item: InventoryItem) => void; onDelete: (id: string) => void; t: (key: string, vars?: Record<string, string | number>) => string }) {
  const isLowStock = item.quantity <= item.low_stock_threshold;
  const step = getUnitStep(item.unit);

  return (
    <div className={`item-row animate-fade-in ${isLowStock ? 'low-stock' : ''}`} data-testid={`item-row-${item.name.toLowerCase()}`} style={{ animationDelay: `${index * 20}ms` }}>
      <div className="item-info">
        <span className="item-name">{item.name}</span>
        {isLowStock && <span className="badge badge-danger">{t('items.low_stock')}</span>}
      </div>
      <div className="item-controls">
        <div className="quantity-control">
          <button onClick={() => onUpdate(item.id, -step)} className="qty-btn" disabled={disabled || item.quantity <= 0} aria-label={t('items.decrease_aria', { name: item.name })} data-testid={`btn-quantity-decrement-${item.id}`}>−</button>
          <span className="qty-value" aria-live="polite">{item.quantity} {item.unit}</span>
          <button onClick={() => onUpdate(item.id, step)} className="qty-btn" disabled={disabled} aria-label={t('items.increase_aria', { name: item.name })} data-testid={`btn-quantity-increment-${item.id}`}>+</button>
        </div>
        <button onClick={() => onEdit(item)} className="action-btn" disabled={disabled} aria-label={t('items.edit_aria', { name: item.name })} data-testid={`btn-edit-item-${item.id}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button onClick={() => onDelete(item.id)} className="action-btn danger" disabled={disabled} aria-label={t('items.delete_aria', { name: item.name })} data-testid={`btn-delete-item-${item.id}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
