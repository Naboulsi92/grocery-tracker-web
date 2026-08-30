-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create units table first (referenced by items)
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  abbrev text NOT NULL
);

-- Insert default units
INSERT INTO units (name, abbrev) VALUES
  ('Unité', 'u'),
  ('Kilogramme', 'kg'),
  ('Gramme', 'g'),
  ('Litre', 'L'),
  ('Millilitre', 'mL'),
  ('Pack', 'pack'),
  ('Boîte', 'boîte')
ON CONFLICT (name) DO NOTHING;

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Household members (many-to-many between users and households)
CREATE TABLE IF NOT EXISTS household_members (
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  icon text DEFAULT '📦',
  "order" int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_id uuid REFERENCES units(id) NOT NULL,
  low_stock_threshold numeric NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id),
  last_modified_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- RLS Policies for households
CREATE POLICY "Users can view their own households"
  ON households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert households they belong to"
  ON households FOR INSERT
  WITH CHECK (true);

-- RLS Policies for household_members
CREATE POLICY "Users can view their own membership"
  ON household_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can join households"
  ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for categories
CREATE POLICY "Users can view categories in their households"
  ON categories FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage categories in their households"
  ON categories FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for items
CREATE POLICY "Users can view items in their households"
  ON items FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage items in their households"
  ON items FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for units (read-only for authenticated users)
CREATE POLICY "Authenticated users can view units"
  ON units FOR SELECT
  USING (auth.role() = 'authenticated');

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS for push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to automatically add user to household on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  household_id uuid;
BEGIN
  -- Create a default household for the new user
  INSERT INTO households (name)
  VALUES ('Mon Foyer')
  RETURNING id INTO household_id;
  
  -- Add the user as a member of their new household
  INSERT INTO household_members (household_id, user_id)
  VALUES (household_id, NEW.id);
  
  -- Create default categories
  INSERT INTO categories (household_id, name, icon, "order") VALUES
    (household_id, 'Fruits & Légumes', '🥦', 1),
    (household_id, 'Produits laitiers', '🥛', 2),
    (household_id, 'Pain & Pâtisserie', '🥖', 3),
    (household_id, 'Viande & Poisson', '🍖', 4),
    (household_id, 'Épicerie', '🥫', 5),
    (household_id, 'Hygiène & Entretien', '🧼', 6);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update last_modified_at on item update
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_last_modified
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_last_modified();