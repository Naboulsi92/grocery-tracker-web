'use client';

export const dynamic = 'force-dynamic';

import { Fragment, useState, useEffect, useCallback, useEffectEvent, useRef, type RefObject } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SyncingIndicator } from '@/components/SyncingIndicator';
import { getErrorMessage, groupItems, isLowStock, joinInventory, CATEGORY_COLUMNS, ITEM_COLUMNS, type Category, type InventoryItem } from '@/lib/inventory';
import { applyCategoryPatch, applyItemPatch, clearEmbeddedCategory, refreshEmbeddedCategories } from '@/lib/realtimePatch';
import { useHouseholdRealtime } from '@/hooks/useHouseholdRealtime';
import { createItem, updateItem, updateItemQuantity, deleteItem } from '@/lib/itemOperations';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { AccessibleDialog } from '@/components/AccessibleDialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useResyncOnReconnect } from '@/hooks/useResyncOnReconnect';
import { validateBuyQuantity, validateName, validateQuantity, validateThreshold, validateUnit, ThresholdErrors } from '@/lib/validation';
import { translateMessage } from '@/lib/i18n';
import { UNITS, getUnitStep, isUnit, type Unit } from '@/types/units';
import type { Language } from '@/i18n/settings';

export default function ItemsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Ticket #222 : unit the edited item had when the form opened — an emptied
  // quantity after a unit change means 0 (cleared), otherwise "untouched".
  const [editingOriginalUnit, setEditingOriginalUnit] = useState<Unit | null>(null);
  const [formName, setFormName] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnit, setFormUnit] = useState<Unit>('unite');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formThreshold, setFormThreshold] = useState('1');
  // Ticket #252 : « Quantité à acheter » — édition uniquement (création sans
  // intention, champ absent). Chaîne vide = pas d'intention.
  const [formBuyQuantity, setFormBuyQuantity] = useState('');
  const [error, setError] = useState('');
  const [fieldNameError, setFieldNameError] = useState('');
  const [fieldQuantityError, setFieldQuantityError] = useState('');
  const [fieldThresholdError, setFieldThresholdError] = useState('');
  const [fieldBuyQuantityError, setFieldBuyQuantityError] = useState('');
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
  // Ticket #251 MS2 : refs de la carte d'édition inline, câblées par la page
  // sur l'unique ItemFormCard d'édition (focus du champ Nom + scrollIntoView
  // de la carte). La création en haut de page ne les utilise pas.
  const editCardRef = useRef<HTMLDivElement | null>(null);
  const editNameInputRef = useRef<HTMLInputElement | null>(null);
  // Dernière rangée dont la carte était ouverte : sert à la restitution du
  // focus sur son bouton ✎ quand la carte se ferme (MS2, point 5).
  const lastOpenEditingIdRef = useRef<string | null>(null);

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

  // Ticket #123 : multiplexed channel + incremental patches. fetchData stays
  // as the full-resync fallback (initial load, reconnect, patch failure).
  // The hook always calls the latest closure, so `categories` below is fresh.
  useHouseholdRealtime({
    supabase,
    householdId: householdId ?? '',
    enabled: Boolean(householdId),
    onPatch: (patch) => {
      if (patch.table === 'categories') {
        setCategories((current) => applyCategoryPatch(current, patch));
        if (patch.event === 'DELETE') {
          const id = patch.oldRecord?.id;
          if (typeof id === 'string') {
            setItems((current) => clearEmbeddedCategory(current, id));
          }
        } else if (patch.newRecord && typeof patch.newRecord.id === 'string') {
          const category = patch.newRecord as unknown as Category;
          setItems((current) => refreshEmbeddedCategories(current, category));
        }
        return;
      }
      setItems((current) => applyItemPatch(current, categories, patch));
    },
    // loadData (useEffectEvent) is effect-scoped only: the resync fallback
    // calls the underlying useCallback instead.
    onResyncNeeded: () => {
      void fetchData();
    },
  });

  useEffect(() => {
    if (!householdId) return;

    queueMicrotask(() => void loadData(true));

    return () => {
      requestId.current += 1;
    };
  }, [householdId, supabase]);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError('');
  setFieldNameError('');
  setFieldQuantityError('');
  setFieldThresholdError('');
  setFieldBuyQuantityError('');
  setFieldUnitError('');

  if (!householdId || !formUnit || mutating || !isOnline) return;

  const unitErr = validateUnit(formUnit);
  if (unitErr) { setFieldUnitError(unitErr); return; }

  const nameErr = validateName(formName);
  if (nameErr) { setFieldNameError(nameErr); return; }

  const duplicateItem = items.some(
    (item) => item.id !== editingId && item.name.trim().toLowerCase() === formName.trim().toLowerCase(),
  );
  if (duplicateItem) { setFieldNameError('items.duplicate'); return; }

  // Ticket #175 : quantity is validated AND saved in both modes (it used to
  // be silently dropped on edit). Empty keeps the historical create default
  // (1); on edit an emptied field keeps the current quantity — clearing is
  // treated as "untouched", never as NaN.
  const qtyErr = validateQuantity(formQuantity);
  if (qtyErr) { setFieldQuantityError(qtyErr); return; }

  const thresholdEmpty = formThreshold.trim() === '';
  // Number (et pas parseInt) : la valeur validée doit être exactement celle
  // stockée — « 0.5 » est rejeté comme décimal, jamais tronqué en 0 silencieux.
  const thresholdVal = thresholdEmpty ? null : Number(formThreshold);
  // Ticket #222 : the threshold is mandatory in BOTH create and edit. An
  // emptied threshold (e.g. after a unit change, PRD §4.4) must be re-entered,
  // never persisted as NULL — a NULL threshold is the "black hole": it is never
  // low-stock and never reminded. After this check thresholdVal is a number in
  // every path (empty, non-numeric and decimals all fail here / below).
  if (thresholdVal === null) {
    setFieldThresholdError(ThresholdErrors.REQUIRED);
    return;
  }
  const thresholdErr = validateThreshold(thresholdVal);
  if (thresholdErr) { setFieldThresholdError(thresholdErr); return; }

  // Ticket #252 : l'intention d'achat est optionnelle (vide → aucune) mais
  // doit être un entier ≥ 1 quand elle est saisie.
  const buyErr = validateBuyQuantity(formBuyQuantity);
  if (buyErr) { setFieldBuyQuantityError(buyErr); return; }

  // #252 : le champ ne vit qu'en édition ; la valeur voyage TOUJOURS
  // explicitement en édition (nombre ou null) pour permettre d'effacer
  // l'intention ; la création reste sans clé buy_quantity.
  const editBuyQuantity = formBuyQuantity.trim() === '' ? null : Number(formBuyQuantity.trim());

  setMutating('form');

  // Ticket #175 : the edited quantity travels with the update (see above for
  // the empty-field rule). A literal 0 stays a valid quantity (out of stock)
  // and must survive — `parseInt(...) || 1` would swallow it.
  const editingCurrentQuantity = editingId
    ? items.find((item) => item.id === editingId)?.quantity ?? 1
    : 1;
  // Ticket #222 : after a unit change an emptied quantity means 0 (cleared,
  // PRD §4.4) — the #175 "empty keeps current" rule applies only otherwise.
  const unitChangedInForm = editingId !== null && editingOriginalUnit !== null && formUnit !== editingOriginalUnit;
  const editableItemData = {
    name: formName.trim(),
    unit: formUnit,
    category_id: formCategoryId || null,
    quantity: formQuantity.trim() === '' ? (unitChangedInForm ? 0 : editingCurrentQuantity) : parseInt(formQuantity, 10),
  };

    try {
      if (editingId) {
        const { error } = await updateItem(editingId, householdId!, { ...editableItemData, low_stock_threshold: thresholdVal, buy_quantity: editBuyQuantity });
        if (error) throw error;
        await fetchData();
      } else {
        // An empty threshold is rejected above (create AND edit), so
        // thresholdVal is a number here — no `?? 1` fallback (ticket #222).
        const { error } = await createItem(householdId, { ...editableItemData, low_stock_threshold: thresholdVal });
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
    setFormBuyQuantity('');
    setEditingOriginalUnit(null);
    setShowForm(false);
    setEditingId(null);
    setError('');
    setFieldNameError('');
    setFieldQuantityError('');
    setFieldThresholdError('');
    setFieldBuyQuantityError('');
    setFieldUnitError('');
  }

  function startEdit(item: InventoryItem) {
    // Ticket #251 MS2 : la carte d'édition est rendue inline sous la rangée ;
    // un re-clic sur le ✎ de l'article déjà en édition referme la carte par la
    // même voie que « Annuler » (comportement toggle, contrat #251 point 5).
    if (showForm && editingId === item.id) {
      resetForm();
      return;
    }
    setFormName(item.name);
    setFormQuantity(item.quantity.toString());
    setFormUnit(isUnit(item.unit) ? item.unit : 'unite');
    setFormCategoryId(item.category_id || '');
    // Ticket #222 : a NULL threshold (cleared by a unit change) edits as empty.
    setFormThreshold(item.low_stock_threshold?.toString() ?? '');
    // Ticket #252 : a NULL buy quantity (no intention) edits as empty.
    setFormBuyQuantity(item.buy_quantity != null ? String(item.buy_quantity) : '');
    setEditingOriginalUnit(isUnit(item.unit) ? item.unit : 'unite');
    setEditingId(item.id);
    setShowForm(true);
  }

  // Ticket #251 MS2 : focus du champ Nom + scrollIntoView de la carte quand
  // l'édition s'ouvre (null → id) OU se déplace d'une rangée à l'autre
  // (id → autre id). Les deps sont [showForm, editingId] uniquement : la
  // frappe dans le formulaire ne re-déclenche jamais l'effet (pas de focus
  // volé pendant la saisie). À la fermeture (Annuler, toggle, Escape,
  // sauvegarde réussie → resetForm), le focus revient sur le ✎ de la rangée
  // dont la carte vient de se fermer ; best-effort, la rangée peut avoir
  // disparu (suppression, changement de catégorie après fetchData).
  useEffect(() => {
    const isOpen = showForm && editingId !== null;
    const previousId = lastOpenEditingIdRef.current;
    lastOpenEditingIdRef.current = isOpen ? editingId : null;
    if (isOpen) {
      // `?.` sur la méthode : jsdom ne fournit pas scrollIntoView (jest).
      editCardRef.current?.scrollIntoView?.({ block: 'nearest' });
      editNameInputRef.current?.focus();
    } else if (previousId !== null) {
      const trigger = document.querySelector<HTMLElement>(`[data-testid="btn-edit-item-${previousId}"]`);
      trigger?.focus();
    }
  }, [showForm, editingId]);

  // Ticket #251 MS2 : Escape ferme la carte d'édition par la même voie que
  // « Annuler ». Le listener n'est monté que pendant que la carte est ouverte
  // (retiré à la fermeture, nettoyage d'effet propre). Si le dialog de
  // suppression est ouvert en plus de la carte, il gère Escape pour lui-même
  // (AccessibleDialog) et la carte reste ouverte.
  const closeEditCardOnEscape = useEffectEvent(() => {
    // Parité avec les boutons Enregistrer/Annuler (disabled pendant la
    // sauvegarde) : un Escape sur une sauvegarde en cours ne ferme ni
    // n'efface le formulaire — l'utilisateur ne doit pas croire l'écriture
    // annulée. Le dialog de suppression a déjà la main sur Escape.
    if (deleteTarget !== null || mutating === 'form') return;
    resetForm();
  });
  const editCardOpen = showForm && editingId !== null;
  useEffect(() => {
    if (!editCardOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEditCardOnEscape();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editCardOpen]);

  // Ticket #251 MS2 : la carte inline vit dans la rangée de l'article édité.
  // Si celui-ci disparaît de la liste pendant l'édition (suppression locale,
  // patch realtime DELETE), la carte n'a plus d'hôte : on referme le panneau
  // (même voie qu'« Annuler ») pour ne pas laisser la page en état « showForm
  // ouvert sans carte ni voie d'annulation ». Sans inline, l'ancien comportement
  // laissait simplement la carte en haut de page ; le garde-fou préserve ici
  // l'invariant « formulaire ouvert ⇒ annulable ».
  const closeEditIfItemGone = useEffectEvent(() => {
    if (showForm && editingId !== null && !items.some((item) => item.id === editingId)) {
      resetForm();
    }
  });
  useEffect(() => {
    closeEditIfItemGone();
  }, [showForm, editingId, items]);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0 }}>{t('items.title')}</h1>

          {items.length > 0 && !showForm && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
              disabled={!isOnline}
              data-testid="btn-new-item"
            >
              {t('items.new')}
            </button>
          )}
        </div>

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

        {/* Ticket #251 MS2 : seul le mode création reste en haut de page ; la
            carte d'édition est rendue inline dans le groupe, en frère direct
            immédiat du <ItemRow> de l'article édité (voir itemGroups.map). */}
        {showForm && editingId === null && (
          <ItemFormCard
            editingId={null}
            categories={categories}
            formName={formName}
            formQuantity={formQuantity}
            formUnit={formUnit}
            formCategoryId={formCategoryId}
            formThreshold={formThreshold}
            formBuyQuantity={formBuyQuantity}
            setFormName={setFormName}
            setFormQuantity={setFormQuantity}
            setFormUnit={setFormUnit}
            setFormCategoryId={setFormCategoryId}
            setFormThreshold={setFormThreshold}
            setFormBuyQuantity={setFormBuyQuantity}
            fieldNameError={fieldNameError}
            fieldQuantityError={fieldQuantityError}
            fieldThresholdError={fieldThresholdError}
            fieldBuyQuantityError={fieldBuyQuantityError}
            fieldUnitError={fieldUnitError}
            setFieldNameError={setFieldNameError}
            setFieldQuantityError={setFieldQuantityError}
            setFieldThresholdError={setFieldThresholdError}
            setFieldBuyQuantityError={setFieldBuyQuantityError}
            setFieldUnitError={setFieldUnitError}
            mutating={mutating}
            isOnline={isOnline}
            householdId={householdId}
            onSubmit={handleSubmit}
            onCancel={resetForm}
            t={t}
            language={language}
          />
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
                  // Ticket #251 MS2 : Fragment keyé pour garder la carte
                  // d'édition comme frère DOM direct immédiat du <ItemRow>
                  // édité (mêmes enfants du conteneur flex-column du groupe).
                  <Fragment key={item.id}>
                    <ItemRow item={item} index={index} disabled={mutating !== null || !isOnline} onUpdate={updateQuantity} onEdit={startEdit} onDelete={(id: string) => setDeleteTarget(id)} t={t} />
                    {showForm && editingId !== null && item.id === editingId && (
                      <ItemFormCard
                        editingId={editingId}
                        categories={categories}
                        formName={formName}
                        formQuantity={formQuantity}
                        formUnit={formUnit}
                        formCategoryId={formCategoryId}
                        formThreshold={formThreshold}
                        formBuyQuantity={formBuyQuantity}
                        setFormName={setFormName}
                        setFormQuantity={setFormQuantity}
                        setFormUnit={setFormUnit}
                        setFormCategoryId={setFormCategoryId}
                        setFormThreshold={setFormThreshold}
                        setFormBuyQuantity={setFormBuyQuantity}
                        fieldNameError={fieldNameError}
                        fieldQuantityError={fieldQuantityError}
                        fieldThresholdError={fieldThresholdError}
                        fieldBuyQuantityError={fieldBuyQuantityError}
                        fieldUnitError={fieldUnitError}
                        setFieldNameError={setFieldNameError}
                        setFieldQuantityError={setFieldQuantityError}
                        setFieldThresholdError={setFieldThresholdError}
                        setFieldBuyQuantityError={setFieldBuyQuantityError}
                        setFieldUnitError={setFieldUnitError}
                        mutating={mutating}
                        isOnline={isOnline}
                        householdId={householdId}
                        onSubmit={handleSubmit}
                        onCancel={resetForm}
                        t={t}
                        language={language}
                        firstInputRef={editNameInputRef}
                        cardRef={editCardRef}
                      />
                    )}
                  </Fragment>
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
  // Ticket #222 : shared rule — a NULL threshold (cleared by a unit change)
  // never evaluates as low-stock (see isLowStock in lib/inventory).
  const lowStock = isLowStock(item);
  const step = getUnitStep(item.unit);

  return (
    <div className={`item-row animate-fade-in-soft ${lowStock ? 'low-stock' : ''}`} data-testid={`item-row-${item.name.toLowerCase()}`} style={{ animationDelay: `${Math.min(index, 4) * 20}ms` }}>
      <div className="item-info">
        <span className="item-name">{item.name}</span>
        <span className="item-sub">{t('items.stock_line', { qty: item.quantity, unit: item.unit, threshold: item.low_stock_threshold ?? '—' })}</span>
        {lowStock && <span className="badge badge-danger">{t('items.low_stock')}</span>}
      </div>
      <div className="item-controls">
        <div className="quantity-control">
          <button onClick={() => onUpdate(item.id, -step)} className="qty-btn" disabled={disabled || item.quantity <= 0} aria-label={t('items.decrease_aria', { name: item.name })} data-testid={`btn-quantity-decrement-${item.id}`}>−</button>
          <span key={item.quantity} className="qty-value qty-value-flash" aria-live="polite">{item.quantity} {item.unit}</span>
          <button onClick={() => onUpdate(item.id, step)} className="qty-btn qty-btn-plus" disabled={disabled} aria-label={t('items.increase_aria', { name: item.name })} data-testid={`btn-quantity-increment-${item.id}`}>+</button>
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

interface ItemFormCardProps {
  // Ticket #251 MS1 : panneau création/édition extrait tel quel de la page.
  // L'état des champs reste possédé par la page (les deux modes partagent le
  // panneau) ; le composant ne fait que rendre le JSX reçu et câbler les
  // handlers passés en props.
  editingId: string | null;
  categories: Category[];
  formName: string;
  formQuantity: string;
  formUnit: Unit;
  formCategoryId: string;
  formThreshold: string;
  // Ticket #252 : « Quantité à acheter » — la page possède l'état comme pour
  // les autres champs ; le composant ne rend le champ qu'en édition.
  formBuyQuantity: string;
  setFormName: (value: string) => void;
  setFormQuantity: (value: string) => void;
  setFormUnit: (unit: Unit) => void;
  setFormCategoryId: (value: string) => void;
  setFormThreshold: (value: string) => void;
  setFormBuyQuantity: (value: string) => void;
  fieldNameError: string;
  fieldQuantityError: string;
  fieldThresholdError: string;
  fieldBuyQuantityError: string;
  fieldUnitError: string;
  setFieldNameError: (value: string) => void;
  setFieldQuantityError: (value: string) => void;
  setFieldThresholdError: (value: string) => void;
  setFieldBuyQuantityError: (value: string) => void;
  setFieldUnitError: (value: string) => void;
  mutating: string | null;
  isOnline: boolean;
  householdId: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  language: Language;
  // Ticket #251 MS2 : refs optionnelles câblées par la page pour l'usage
  // inline d'édition (focus du premier champ + scrollIntoView de la carte).
  // L'usage création en haut de page ne les passe pas.
  firstInputRef?: RefObject<HTMLInputElement | null>;
  cardRef?: RefObject<HTMLDivElement | null>;
}

function ItemFormCard({ editingId, categories, formName, formQuantity, formUnit, formCategoryId, formThreshold, formBuyQuantity, setFormName, setFormQuantity, setFormUnit, setFormCategoryId, setFormThreshold, setFormBuyQuantity, fieldNameError, fieldQuantityError, fieldThresholdError, fieldBuyQuantityError, fieldUnitError, setFieldNameError, setFieldQuantityError, setFieldThresholdError, setFieldBuyQuantityError, setFieldUnitError, mutating, isOnline, householdId, onSubmit, onCancel, t, language, firstInputRef, cardRef }: ItemFormCardProps) {
  return (
    <div ref={cardRef} className="card" style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ marginBottom: '1.25rem', fontSize: '1.125rem' }}>
        {editingId ? t('items.edit_title') : t('items.new')}
      </h2>
      <form onSubmit={onSubmit} noValidate style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="form-group">
          <label htmlFor="item-name">{t('items.name')}</label>
          <input ref={firstInputRef} id="item-name" type="text" data-testid="input-item-name" value={formName} onChange={(e) => { setFormName(e.target.value); setFieldNameError(''); }} required placeholder={t('items.name_placeholder')} aria-invalid={!!fieldNameError} aria-describedby={fieldNameError ? 'item-name-error' : undefined} />
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
          <input id="item-threshold" type="number" data-testid="input-item-threshold" value={formThreshold} onChange={(e) => { setFormThreshold(e.target.value); setFieldThresholdError(''); }} min="0" step={getUnitStep(formUnit)} aria-invalid={!!fieldThresholdError} aria-describedby={fieldThresholdError ? 'item-threshold-error' : undefined} />
          {fieldThresholdError && <p className="field-error" role="alert" id="item-threshold-error" data-testid="error-threshold-required">{translateMessage(language, fieldThresholdError)}</p>}
        </div>
        {/* Ticket #252 : l'intention d'achat n'existe qu'en édition ; la
            création reste sans champ ni clé buy_quantity (micro-step MS3 du
            ticket s'occupera du restock /to-buy). */}
        {editingId !== null && (
          <div className="form-group">
            <label htmlFor="item-buy-quantity">{t('items.buy_quantity_label')}</label>
            <input id="item-buy-quantity" type="number" data-testid="input-item-buy-quantity" value={formBuyQuantity} onChange={(e) => { setFormBuyQuantity(e.target.value); setFieldBuyQuantityError(''); }} min="1" step="1" aria-invalid={!!fieldBuyQuantityError} aria-describedby={fieldBuyQuantityError ? 'item-buy-quantity-error' : undefined} />
            {fieldBuyQuantityError && <p className="field-error" role="alert" id="item-buy-quantity-error" data-testid="error-buy-quantity-invalid">{translateMessage(language, fieldBuyQuantityError)}</p>}
          </div>
        )}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={mutating === 'form' || !isOnline || !householdId} data-testid="btn-create-item">{editingId ? t('common.save') : t('common.create')}</button>
          <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={mutating === 'form'} data-testid="btn-cancel-item">{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  );
}
