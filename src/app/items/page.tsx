'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';

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
  const supabase = createClient();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [user, router, supabase]);

  async function fetchData() {
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
      supabase.from('items').select('*, categories(id, name, icon), units(id, name, abbrev)').eq('household_id', memberData.household_id),
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

    if (!user || !formName.trim() || !formUnitId) return;

    const { data: memberData } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (!memberData?.household_id) return;

    const itemData = {
      household_id: memberData.household_id,
      name: formName.trim(),
      quantity: parseFloat(formQuantity) || 0,
      unit_id: formUnitId,
      category_id: formCategoryId || null,
      low_stock_threshold: parseFloat(formThreshold) || 1,
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  const itemsByCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = { category: cat, items: items.filter(i => i.category_id === cat.id) };
    return acc;
  }, {} as Record<string, { category: Category; items: Item[] }>);

  const uncategorizedItems = items.filter(i => !i.category_id);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/home" className="text-gray-600 hover:text-gray-900">
              ← Retour
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Articles</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Nouvel article
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">
              {editingId ? 'Modifier l\'article' : 'Nouvel article'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Ex: Pommes"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Aucune</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantite</label>
                  <input
                    type="number"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unite</label>
                  <select
                    value={formUnitId}
                    onChange={(e) => setFormUnitId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {units.map(unit => (
                      <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbrev})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seuil de stock</label>
                  <input
                    type="number"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingId ? 'Enregistrer' : 'Creer'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {Object.entries(itemsByCategory).map(([catId, { category, items: catItems }]) => (
          <div key={catId} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span>{category.icon}</span> {category.name}
            </h2>
            <div className="space-y-2">
              {catItems.map(item => (
                <ItemRow key={item.id} item={item} onUpdate={updateQuantity} onEdit={startEdit} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        ))}

        {uncategorizedItems.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Sans categorie</h2>
            <div className="space-y-2">
              {uncategorizedItems.map(item => (
                <ItemRow key={item.id} item={item} onUpdate={updateQuantity} onEdit={startEdit} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && !showForm && (
          <div className="text-center py-12 text-gray-500">
            Aucun article. Creez-en un pour commencer.
          </div>
        )}
      </main>
    </div>
  );
}

function ItemRow({ item, onUpdate, onEdit, onDelete }: { item: Item; onUpdate: (id: string, delta: number) => void; onEdit: (item: Item) => void; onDelete: (id: string) => void }) {
  const isLowStock = item.quantity <= item.low_stock_threshold;
  
  return (
    <div className={`bg-white rounded-lg shadow p-4 flex items-center justify-between ${isLowStock ? 'border-l-4 border-red-500' : ''}`}>
      <div className="flex-1">
        <span className="font-medium text-gray-900">{item.name}</span>
        {isLowStock && (
          <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">A acheter</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdate(item.id, -1)}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
          >
            -
          </button>
          <span className="w-16 text-center font-medium">
            {item.quantity} {(item as any).units?.abbrev || ''}
          </span>
          <button
            onClick={() => onUpdate(item.id, 1)}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
          >
            +
          </button>
        </div>
        <button onClick={() => onEdit(item)} className="text-gray-400 hover:text-gray-600">✏️</button>
        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600">🗑️</button>
      </div>
    </div>
  );
}