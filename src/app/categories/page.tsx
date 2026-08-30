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
    if (!confirm('Supprimer cette categorie ?')) return;

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/home" className="text-gray-600 hover:text-gray-900">
              ← Retour
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Categories</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Nouvelle categorie
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
              {editingId ? 'Modifier la categorie' : 'Nouvelle categorie'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Ex: Fruits & Legumes"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icone
                </label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormIcon(icon)}
                      className={`text-2xl p-2 rounded-md ${
                        formIcon === icon ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-100'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
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
                  onClick={cancelForm}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{category.icon}</span>
                <span className="font-medium text-gray-900">{category.name}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(category)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="text-gray-400 hover:text-red-600"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {categories.length === 0 && !showForm && (
          <div className="text-center py-12 text-gray-500">
            Aucune categorie. Creez-en une pour commencer.
          </div>
        )}
      </main>
    </div>
  );
}