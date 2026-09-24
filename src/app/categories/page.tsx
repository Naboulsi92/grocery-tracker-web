'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useEffectEvent, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage, getNextCategoryOrder, CATEGORY_COLUMNS, type Category } from '@/lib/inventory';
import { applyCategoryPatch } from '@/lib/realtimePatch';
import { useHouseholdRealtime } from '@/hooks/useHouseholdRealtime';
import { hasDuplicateCustomName } from '@/lib/categories';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { AccessibleDialog } from '@/components/AccessibleDialog';
import { validateName } from '@/lib/validation';
import { logItemHistory } from '@/lib/history';
import { translateMessage } from '@/lib/i18n';
import ThemeToggle from '@/components/ThemeToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useResyncOnReconnect } from '@/hooks/useResyncOnReconnect';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

const CATEGORY_ICONS: Record<string, string> = {
  Légumes: '🥬',
  Fruits: '🍎',
  'Produits laitiers': '🧀',
  Féculents: '🌾',
  Viandes: '🥩',
  Poissons: '🐟',
  Épicerie: '🛒',
  Boissons: '🥤',
  Hygiène: '🧴',
  Entretien: '🧹',
};

function SortableCategoryRow({
  category,
  mutating,
  isOnline,
  onEdit,
  onDelete,
}: {
  category: Category;
  mutating: string | null;
  isOnline: boolean;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id, disabled: !isOnline });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const icon = CATEGORY_ICONS[category.name] ?? '📦';
  const actionsDisabled = mutating !== null || !isOnline;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="category-card animate-fade-in"
      data-testid={`category-item-${category.name.toLowerCase()}`}
    >
      <div
        className="dnd-drag-handle"
        data-testid="category-drag-handle"
        {...attributes}
        {...listeners}
        aria-label={t('categories.move_aria', { name: category.name })}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </div>
      <div className="category-info">
        <span className="category-icon">{icon}</span>
        <span className="category-name">{category.name}</span>
      </div>
      <div className="category-actions">
        {!category.is_default && (
          <>
            <button
              onClick={() => onEdit(category)}
              className="action-btn"
              disabled={actionsDisabled}
              aria-label={t('categories.edit_aria', { name: category.name })}
              data-testid="category-edit-button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={() => onDelete(category.id)}
              className="action-btn danger"
              disabled={actionsDisabled}
              aria-label={t('categories.delete_aria', { name: category.name })}
              data-testid="category-delete-button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [error, setError] = useState('');
  const [fieldNameError, setFieldNameError] = useState('');
  const [deleteBlocked, setDeleteBlocked] = useState<{ id: string; count: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);
  const { householdId } = useAuth();
  const { t, language } = useI18n();
  const { isOnline } = useOnlineStatus();
  const { household, loading: householdLoading, error: householdError } = useHousehold(householdId ?? '');
  const isLoading = loading || householdLoading;
  const combinedError = householdError || error;
  const [supabase] = useState(createClient);
  const requestId = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchCategories = useCallback(async (showLoading = false) => {
    if (!householdId) return;
    const currentRequest = ++requestId.current;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const [categoriesRes, positionsRes] = await Promise.all([
        // Ticket #117 : colonnes explicites (Row complet, pas de '*').
        // Inventaire SANS pagination (décision ticket).
        supabase.from('categories').select(CATEGORY_COLUMNS).eq('household_id', householdId),
        supabase.from('category_positions').select('category_id, position').eq('household_id', householdId),
      ]);
      if (categoriesRes.error) throw categoriesRes.error;
      if (currentRequest === requestId.current) {
        const posMap: Record<string, number> = {};
        for (const p of positionsRes.data ?? []) posMap[p.category_id] = p.position;
        setPositions(posMap);
        setCategories((categoriesRes.data ?? []).sort((a, b) => (posMap[a.id] ?? 0) - (posMap[b.id] ?? 0)));
      }
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(getErrorMessage(loadError, 'error.load_categories'));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [householdId, supabase]);
  const loadCategories = useEffectEvent(fetchCategories);

  // Resync background silencieuse à la reconnexion (PRD §4.12 + §5).
  useResyncOnReconnect(fetchCategories);

  // Ticket #123 : multiplexed channel + incremental patches. fetchCategories
  // stays as the full-resync fallback (initial load, reconnect, patch
  // failure). Items-table events are ignored: this page renders no items.
  // NOTE: no binding on category_positions on purpose. That table is
  // outside the supabase_realtime publication (contract: exactly
  // {categories, items}), and binding it starves the whole channel: no
  // categories events arrive at all (trace-proven across 5 CI runs in #111).
  // Positions-only changes (reorder) carry no realtime signal — acceptable,
  // no P0 covers cross-page reorder; every other change touches categories
  // too, and order converges on the next full fetch.
  useHouseholdRealtime({
    supabase,
    householdId: householdId ?? '',
    enabled: Boolean(householdId),
    onPatch: (patch) => {
      if (patch.table !== 'categories') return;
      if (patch.event === 'DELETE' && typeof patch.oldRecord?.id === 'string') {
        const deletedId = patch.oldRecord.id;
        setPositions((current) => {
          const next = { ...current };
          delete next[deletedId];
          return next;
        });
      }
      setCategories((current) => applyCategoryPatch(current, patch));
    },
    // loadCategories (useEffectEvent) is effect-scoped only: the resync
    // fallback calls the underlying useCallback instead.
    onResyncNeeded: () => {
      void fetchCategories();
    },
  });

  useEffect(() => {
    if (!householdId) return;

    queueMicrotask(() => void loadCategories(true));

    return () => {
      requestId.current += 1;
    };
  }, [householdId, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldNameError('');

    if (!householdId || !formName.trim() || mutating || !isOnline) return;

    const nameErr = validateName(formName);
    if (nameErr) { setFieldNameError(nameErr); return; }

    if (hasDuplicateCustomName(categories, formName, editingId)) {
      setFieldNameError('categories.duplicate');
      return;
    }

    setMutating('form');

    try {
      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('categories')
          .update({ name: formName.trim() })
          .eq('id', editingId)
          .eq('household_id', householdId)
          .select(CATEGORY_COLUMNS)
          .single();
        if (updateError) throw updateError;
        setCategories((current) => current.map((category) => category.id === data.id ? data : category));
        await logItemHistory(householdId, 'modification', data.name, supabase);
      } else {
        const { data, error: insertError } = await supabase
          .from('categories')
          .insert({
            household_id: householdId,
            name: formName.trim(),
          })
          .select(CATEGORY_COLUMNS)
          .single();
        if (insertError) throw insertError;

        const nextPosition = getNextCategoryOrder(Object.values(positions));
        const { error: positionError } = await supabase
          .from('category_positions')
          .insert({ household_id: householdId, category_id: data.id, position: nextPosition });

        // Position insert runs after the category row already exists. On
        // failure, best-effort remove the orphaned category, then surface the
        // save error via the page's catch (matches the reorder/delete patterns).
        if (positionError) {
          await supabase.from('categories').delete().eq('id', data.id).eq('household_id', householdId);
          throw positionError;
        }

        setCategories((current) => [...current, data]);
        setPositions((prev) => ({ ...prev, [data.id]: nextPosition }));
      }
      // Local mutation applied above: invalidate in-flight fetches so a stale
      // response cannot overwrite it (the realtime event refetch carries a newer id).
      requestId.current += 1;
      cancelForm();
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'error.save_category'));
    } finally {
      setMutating(null);
    }
  }

  async function handleDelete(id: string) {
    if (!householdId || mutating || !isOnline) return;
    setError('');
    setDeleteBlocked(null);

    const { count, error: countError } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)
      .eq('household_id', householdId);

    if (countError) {
      setError(getErrorMessage(countError, 'error.verify_items'));
      return;
    }

    if (count && count > 0) {
      setDeleteBlocked({ id, count });
      return;
    }

    setMutating(id);

    try {
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('household_id', householdId)
        .select('id')
        .single();
      if (deleteError) throw deleteError;
      const deletedName = categories.find((category) => category.id === id)?.name;
      if (deletedName) {
        await logItemHistory(householdId, 'suppression', deletedName, supabase);
      }
      // Local mutation applied below: invalidate in-flight fetches so a stale
      // response cannot resurrect the deleted row.
      requestId.current += 1;
      setCategories((current) => current.filter((category) => category.id !== id));
      setPositions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, 'error.delete_category'));
    } finally {
      setMutating(null);
    }
  }

  function startEdit(category: Category) {
    setFormName(category.name);
    setEditingId(category.id);
    setShowForm(true);
    setFieldNameError('');
  }

  function cancelForm() {
    setFormName('');
    setShowForm(false);
    setEditingId(null);
    setError('');
    setFieldNameError('');
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !householdId || !isOnline) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex);
    const newPosMap: Record<string, number> = {};
    reordered.forEach((cat, i) => {
      newPosMap[cat.id] = i;
    });

    setCategories(reordered);
    setPositions(newPosMap);

    try {
      const upserts = reordered.map((cat, i) =>
        supabase
          .from('category_positions')
          .upsert(
            { household_id: householdId, category_id: cat.id, position: i },
            { onConflict: 'household_id,category_id' },
          ),
      );
      const results = await Promise.all(upserts);
      const firstError = results.find((r) => r.error);
      if (firstError?.error) {
        throw firstError.error;
      }
    } catch {
      setError('categories.reorder_error');
      setCategories(categories);
      setPositions(positions);
    }
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

  const defaultCategories = categories.filter((c) => c.is_default);
  const customCategories = categories.filter((c) => !c.is_default);

  return (
    <div className="page-container">
      <OfflineBanner />
      <AuthenticatedHeader showBackLink household={household} loading={householdLoading} error={householdError} />

      <main className="app-main" id="main">
        <h1>{t('categories.title')}</h1>

        {combinedError && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {translateMessage(language, combinedError)}
            <button type="button" className="btn btn-secondary" onClick={() => void fetchCategories(true)} data-testid="btn-retry-categories">{t('common.retry')}</button>
          </div>
        )}

        {categories.length > 0 && !showForm && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginBottom: '1.5rem' }}
            onClick={() => setShowForm(true)}
            disabled={!isOnline}
            data-testid="btn-new-category"
          >
            {t('categories.new')}
          </button>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.125rem' }}>
              {editingId ? t('categories.edit_title') : t('categories.new')}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label htmlFor="category-name">{t('categories.name')}</label>
                <input
                  id="category-name"
                  type="text"
                  data-testid="input-category-name"
                  value={formName}
                  onChange={(e) => { setFormName(e.target.value); setFieldNameError(''); }}
                  required
                  placeholder={t('categories.name_placeholder')}
                  aria-invalid={!!fieldNameError}
                  aria-describedby={fieldNameError ? 'category-name-error' : undefined}
                />
                {fieldNameError && <p className="field-error" role="alert" id="category-name-error" data-testid={fieldNameError === 'categories.duplicate' ? 'error-name-duplicate' : fieldNameError === 'validation.name.too_long' ? 'error-name-too-long' : 'error-name-required-letter'}>{translateMessage(language, fieldNameError)}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" disabled={mutating === 'form' || !isOnline || !householdId} data-testid="btn-create-category">
                  {editingId ? t('common.save') : t('common.create')}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="btn btn-secondary"
                  disabled={mutating === 'form'}
                  data-testid="btn-cancel-category"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {deleteTarget && (
          <AccessibleDialog
            title={categories.find((category) => category.id === deleteTarget)?.name ?? ''}
            message={t('categories.delete_confirm')}
            confirmLabel={t('common.confirm')}
            cancelLabel={t('common.cancel')}
            confirmTestId="category-delete-confirm"
            cancelTestId="category-delete-cancel"
            dialogTestId="category-delete-dialog"
            onConfirm={() => {
              const id = deleteTarget;
              setDeleteTarget(null);
              void handleDelete(id);
            }}
            onCancel={() => setDeleteTarget(null)}
          />
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {defaultCategories.length > 0 && (
            <section data-testid="category-section-default" style={{ marginBottom: '2rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                {t('categories.default_section')}
              </h2>
              <div className="categories-grid">
                  {defaultCategories.map((category) => (
                    <SortableCategoryRow
                      key={category.id}
                      category={category}
                      mutating={mutating}
                      isOnline={isOnline}
                      onEdit={startEdit}
                      onDelete={(id: string) => setDeleteTarget(id)}
                    />
                  ))}
              </div>
            </section>
          )}

          {customCategories.length > 0 && (
            <section data-testid="category-section-custom" style={{ marginBottom: '2rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                {t('categories.custom_section')}
              </h2>
              <div className="categories-grid">
                  {customCategories.map((category) => (
                    <SortableCategoryRow
                      key={category.id}
                      category={category}
                      mutating={mutating}
                      isOnline={isOnline}
                      onEdit={startEdit}
                      onDelete={(id: string) => setDeleteTarget(id)}
                    />
                  ))}
              </div>
              {customCategories.map((category) =>
                deleteBlocked && deleteBlocked.id === category.id ? (
                  <div
                    key={`blocked-${category.id}`}
                    className="auth-error"
                    role="alert"
                    style={{ marginTop: '0.75rem' }}
                    data-testid="category-delete-blocked-message"
                  >
                    <span data-testid="error-category-not-empty">{t('categories.delete_blocked', { count: deleteBlocked.count })}</span>
                  </div>
                ) : null,
              )}
            </section>
          )}
          </SortableContext>
        </DndContext>

      </main>
    </div>
  );
}
