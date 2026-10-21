CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category VARCHAR(100) NOT NULL,
  sku VARCHAR(60) NOT NULL UNIQUE,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
CREATE INDEX IF NOT EXISTS products_name_idx ON products (name);

INSERT INTO products (name, description, category, sku, price, stock) VALUES
  ('Cuaderno profesional', 'Cuaderno de 100 hojas, raya.', 'Cuadernos', 'CUA-PRO-001', 52.50, 35),
  ('Lápiz HB', 'Lápiz de grafito HB con borrador.', 'Escritura', 'LAP-HB-001', 6.00, 120),
  ('Bolígrafo azul', 'Bolígrafo de tinta azul, punto mediano.', 'Escritura', 'BOL-AZU-001', 9.50, 80),
  ('Resaltador amarillo', 'Marcador fluorescente con punta biselada.', 'Marcadores', 'RES-AMA-001', 18.00, 25),
  ('Papel bond carta', 'Paquete con 500 hojas blancas tamaño carta.', 'Papel', 'PAP-BON-001', 119.00, 18),
  ('Pegamento en barra', 'Adhesivo escolar lavable de 21 g.', 'Adhesivos', 'PEG-BAR-001', 15.00, 40)
ON CONFLICT (sku) DO NOTHING;
