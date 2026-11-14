/*
# BirdDex — coleção (catálogo) e conquistas

Sistema estilo Pokédex: existe um catálogo fixo de aves; ao "capturar" uma ave (identificá-la
pela câmera ou publicá-la com a espécie preenchida) ela é desbloqueada na coleção do usuário
e conquistas podem ser liberadas.

## Tabelas
1. `bird_species`      — catálogo de aves (170 espécies iniciais). `aliases` guarda sinônimos científicos e apelidos.
2. `user_captures`     — espécies já capturadas por cada usuário (uma por espécie), com foto e local.
3. `achievements`      — definição das conquistas, orientada a dados (métrica + filtro + mínimo).
4. `user_achievements` — conquistas já desbloqueadas por cada usuário.

## Funções
- `normalize_bird_name` / `bird_binomial` — normalizam nomes (sem acento, caixa ou hífen) para comparar.
- `match_bird_species`   — acha a espécie do catálogo a partir do nome científico e/ou popular.
- `achievement_progress` — quantas capturas o usuário tem para uma métrica de conquista.
- `capture_bird`         — captura uma espécie e libera conquistas, tudo na mesma transação.

## Segurança
- RLS ligada em todas as tabelas; usuários autenticados só podem LER.
- Capturas e conquistas são gravadas SOMENTE por `capture_bird` (SECURITY DEFINER), nunca direto pelo app.

## Como ampliar
- Mais aves:      INSERT em `bird_species` (dex_number novo, nomes e raridade).
- Mais conquistas: INSERT em `achievements` (metric: total | rarity | grupo | species).
- Esta migração é idempotente: pode rodar de novo sem duplicar nada.
*/

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bird_species (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dex_number integer UNIQUE NOT NULL,
  common_name text NOT NULL,
  scientific_name text UNIQUE NOT NULL,
  grupo text NOT NULL DEFAULT 'Pássaros',
  rarity text NOT NULL DEFAULT 'comum' CHECK (rarity IN ('comum', 'incomum', 'raro', 'lendario')),
  aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  species_id uuid NOT NULL REFERENCES bird_species(id) ON DELETE CASCADE,
  photo_url text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, species_id)
);

CREATE INDEX IF NOT EXISTS user_captures_user_idx ON user_captures (user_id);

CREATE TABLE IF NOT EXISTS achievements (
  code text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Trophy',
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'prata', 'ouro')),
  metric text NOT NULL CHECK (metric IN ('total', 'rarity', 'grupo', 'species')),
  filter_value text NOT NULL DEFAULT '',
  threshold integer NOT NULL DEFAULT 1 CHECK (threshold > 0),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_code text NOT NULL REFERENCES achievements(code) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_code)
);

-- ---------------------------------------------------------------------------
-- Segurança (somente leitura para o app; escrita só pela função capture_bird)
-- ---------------------------------------------------------------------------

ALTER TABLE bird_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON bird_species, user_captures, achievements, user_achievements TO authenticated;

DROP POLICY IF EXISTS "bird_species_select_all" ON bird_species;
CREATE POLICY "bird_species_select_all" ON bird_species FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "user_captures_select_all" ON user_captures;
CREATE POLICY "user_captures_select_all" ON user_captures FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "achievements_select_all" ON achievements;
CREATE POLICY "achievements_select_all" ON achievements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "user_achievements_select_all" ON user_achievements;
CREATE POLICY "user_achievements_select_all" ON user_achievements FOR SELECT
  TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------

-- "Sabiá-Laranjeira" -> "sabia laranjeira"
CREATE OR REPLACE FUNCTION public.normalize_bird_name(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(
    translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'))
$$;

-- "Furnarius rufus rufus" -> "furnarius rufus" (descarta subespécie)
CREATE OR REPLACE FUNCTION public.bird_binomial(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(public.normalize_bird_name(p), '^([a-z0-9]+ [a-z0-9]+).*$', '\1')
$$;

-- Acha a espécie do catálogo pelo nome científico (preferencial) ou popular.
CREATE OR REPLACE FUNCTION public.match_bird_species(p_scientific text, p_common text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT nullif(public.bird_binomial(p_scientific), '') AS sci,
           nullif(public.normalize_bird_name(p_common), '') AS com
  )
  SELECT s.id
  FROM public.bird_species s, q
  WHERE (q.sci IS NOT NULL AND (
          public.bird_binomial(s.scientific_name) = q.sci
          OR EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.bird_binomial(a) = q.sci)))
     OR (q.com IS NOT NULL AND (
          public.normalize_bird_name(s.common_name) = q.com
          OR EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_bird_name(a) = q.com)))
  ORDER BY (q.sci IS NOT NULL AND public.bird_binomial(s.scientific_name) = q.sci) DESC, s.dex_number
  LIMIT 1
$$;

-- Quantas capturas do usuário contam para uma conquista.
CREATE OR REPLACE FUNCTION public.achievement_progress(p_user uuid, p_metric text, p_filter text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE p_metric
    WHEN 'total' THEN
      (SELECT count(*)::int FROM public.user_captures c WHERE c.user_id = p_user)
    WHEN 'rarity' THEN
      (SELECT count(*)::int FROM public.user_captures c
         JOIN public.bird_species s ON s.id = c.species_id
        WHERE c.user_id = p_user AND s.rarity = p_filter)
    WHEN 'grupo' THEN
      (SELECT count(*)::int FROM public.user_captures c
         JOIN public.bird_species s ON s.id = c.species_id
        WHERE c.user_id = p_user AND s.grupo = p_filter)
    WHEN 'species' THEN
      (SELECT count(*)::int FROM public.user_captures c
         JOIN public.bird_species s ON s.id = c.species_id
        WHERE c.user_id = p_user AND s.scientific_name = p_filter)
    ELSE 0
  END
$$;

-- ---------------------------------------------------------------------------
-- Catálogo inicial de aves
-- ---------------------------------------------------------------------------

INSERT INTO bird_species (dex_number, common_name, scientific_name, grupo, rarity, aliases) VALUES
  (1, 'Pombo-doméstico', 'Columba livia', 'Pombos e rolas', 'comum', ARRAY['Pombo', 'Pombo-comum']::text[]),
  (2, 'Pomba-asa-branca', 'Patagioenas picazuro', 'Pombos e rolas', 'comum', ARRAY['Pombão', 'Asa-branca']::text[]),
  (3, 'Avoante', 'Zenaida auriculata', 'Pombos e rolas', 'comum', ARRAY['Pomba-de-bando', 'Arribaçã']::text[]),
  (4, 'Rolinha-roxa', 'Columbina talpacoti', 'Pombos e rolas', 'comum', ARRAY['Rolinha']::text[]),
  (5, 'Fogo-apagou', 'Columbina squammata', 'Pombos e rolas', 'comum', ARRAY[]::text[]),
  (6, 'Rolinha-picuí', 'Columbina picui', 'Pombos e rolas', 'comum', ARRAY[]::text[]),
  (7, 'Juriti-pupu', 'Leptotila verreauxi', 'Pombos e rolas', 'comum', ARRAY['Juriti']::text[]),
  (8, 'Periquitão-maracanã', 'Psittacara leucophthalmus', 'Papagaios e araras', 'comum', ARRAY['Aratinga leucophthalma', 'Periquitão']::text[]),
  (9, 'Maitaca-verde', 'Pionus maximiliani', 'Papagaios e araras', 'comum', ARRAY[]::text[]),
  (10, 'Papagaio-verdadeiro', 'Amazona aestiva', 'Papagaios e araras', 'incomum', ARRAY['Papagaio']::text[]),
  (11, 'Papagaio-de-peito-roxo', 'Amazona vinacea', 'Papagaios e araras', 'raro', ARRAY[]::text[]),
  (12, 'Arara-canindé', 'Ara ararauna', 'Papagaios e araras', 'incomum', ARRAY['Arara-amarela']::text[]),
  (13, 'Arara-vermelha-grande', 'Ara chloropterus', 'Papagaios e araras', 'raro', ARRAY['Arara-vermelha']::text[]),
  (14, 'Arara-azul-grande', 'Anodorhynchus hyacinthinus', 'Papagaios e araras', 'raro', ARRAY['Arara-azul']::text[]),
  (15, 'Arara-azul-de-lear', 'Anodorhynchus leari', 'Papagaios e araras', 'lendario', ARRAY[]::text[]),
  (16, 'Ararinha-azul', 'Cyanopsitta spixii', 'Papagaios e araras', 'lendario', ARRAY[]::text[]),
  (17, 'Ararajuba', 'Guaruba guarouba', 'Papagaios e araras', 'lendario', ARRAY[]::text[]),
  (18, 'Jandaia-verdadeira', 'Aratinga jandaya', 'Papagaios e araras', 'incomum', ARRAY[]::text[]),
  (19, 'Tuim', 'Forpus xanthopterygius', 'Papagaios e araras', 'comum', ARRAY[]::text[]),
  (20, 'Periquito-rico', 'Brotogeris tirica', 'Papagaios e araras', 'comum', ARRAY[]::text[]),
  (21, 'Periquito-de-encontro-amarelo', 'Brotogeris chiriri', 'Papagaios e araras', 'comum', ARRAY[]::text[]),
  (22, 'Caturrita', 'Myiopsitta monachus', 'Papagaios e araras', 'comum', ARRAY['Periquito-argentino']::text[]),
  (23, 'Beija-flor-tesoura', 'Eupetomena macroura', 'Beija-flores', 'comum', ARRAY[]::text[]),
  (24, 'Beija-flor-de-papo-branco', 'Leucochloris albicollis', 'Beija-flores', 'comum', ARRAY[]::text[]),
  (25, 'Beija-flor-de-fronte-violeta', 'Thalurania glaucopis', 'Beija-flores', 'incomum', ARRAY[]::text[]),
  (26, 'Besourinho-de-bico-vermelho', 'Chlorostilbon lucidus', 'Beija-flores', 'comum', ARRAY[]::text[]),
  (27, 'Rabo-branco-acanelado', 'Phaethornis pretrei', 'Beija-flores', 'comum', ARRAY[]::text[]),
  (28, 'Beija-flor-roxo', 'Hylocharis cyanus', 'Beija-flores', 'incomum', ARRAY[]::text[]),
  (29, 'Beija-flor-de-banda-branca', 'Amazilia versicolor', 'Beija-flores', 'comum', ARRAY[]::text[]),
  (30, 'Beija-flor-de-peito-azul', 'Amazilia lactea', 'Beija-flores', 'comum', ARRAY['Chionomesa lactea']::text[]),
  (31, 'Tucano-toco', 'Ramphastos toco', 'Tucanos', 'incomum', ARRAY[]::text[]),
  (32, 'Tucano-de-bico-verde', 'Ramphastos dicolorus', 'Tucanos', 'incomum', ARRAY[]::text[]),
  (33, 'Tucano-de-bico-preto', 'Ramphastos vitellinus', 'Tucanos', 'incomum', ARRAY[]::text[]),
  (34, 'Araçari-castanho', 'Pteroglossus castanotis', 'Tucanos', 'incomum', ARRAY[]::text[]),
  (35, 'Pica-pau-do-campo', 'Colaptes campestris', 'Pica-paus', 'comum', ARRAY[]::text[]),
  (36, 'Pica-pau-verde-barrado', 'Colaptes melanochloros', 'Pica-paus', 'comum', ARRAY[]::text[]),
  (37, 'Pica-pau-de-topete-vermelho', 'Campephilus melanoleucos', 'Pica-paus', 'incomum', ARRAY[]::text[]),
  (38, 'Pica-pau-branco', 'Melanerpes candidus', 'Pica-paus', 'incomum', ARRAY[]::text[]),
  (39, 'Picapauzinho-anão', 'Veniliornis passerinus', 'Pica-paus', 'comum', ARRAY[]::text[]),
  (40, 'Gavião-carijó', 'Rupornis magnirostris', 'Aves de rapina', 'comum', ARRAY[]::text[]),
  (41, 'Carcará', 'Caracara plancus', 'Aves de rapina', 'comum', ARRAY['Polyborus plancus']::text[]),
  (42, 'Carrapateiro', 'Milvago chimachima', 'Aves de rapina', 'comum', ARRAY[]::text[]),
  (43, 'Quiriquiri', 'Falco sparverius', 'Aves de rapina', 'comum', ARRAY[]::text[]),
  (44, 'Falcão-peregrino', 'Falco peregrinus', 'Aves de rapina', 'raro', ARRAY[]::text[]),
  (45, 'Gavião-caramujeiro', 'Rostrhamus sociabilis', 'Aves de rapina', 'incomum', ARRAY[]::text[]),
  (46, 'Gavião-de-rabo-branco', 'Geranoaetus albicaudatus', 'Aves de rapina', 'incomum', ARRAY[]::text[]),
  (47, 'Gavião-asa-de-telha', 'Parabuteo unicinctus', 'Aves de rapina', 'incomum', ARRAY[]::text[]),
  (48, 'Gavião-peneira', 'Elanus leucurus', 'Aves de rapina', 'incomum', ARRAY[]::text[]),
  (49, 'Águia-pescadora', 'Pandion haliaetus', 'Aves de rapina', 'raro', ARRAY[]::text[]),
  (50, 'Águia-cinzenta', 'Urubitinga coronata', 'Aves de rapina', 'raro', ARRAY['Harpyhaliaetus coronatus']::text[]),
  (51, 'Harpia', 'Harpia harpyja', 'Aves de rapina', 'lendario', ARRAY['Gavião-real']::text[]),
  (52, 'Urubu-de-cabeça-preta', 'Coragyps atratus', 'Aves de rapina', 'comum', ARRAY['Urubu']::text[]),
  (53, 'Urubu-de-cabeça-vermelha', 'Cathartes aura', 'Aves de rapina', 'comum', ARRAY[]::text[]),
  (54, 'Urubu-rei', 'Sarcoramphus papa', 'Aves de rapina', 'raro', ARRAY[]::text[]),
  (55, 'Coruja-buraqueira', 'Athene cunicularia', 'Corujas', 'comum', ARRAY[]::text[]),
  (56, 'Corujinha-do-mato', 'Megascops choliba', 'Corujas', 'comum', ARRAY[]::text[]),
  (57, 'Caburé', 'Glaucidium brasilianum', 'Corujas', 'comum', ARRAY[]::text[]),
  (58, 'Suindara', 'Tyto furcata', 'Corujas', 'incomum', ARRAY['Tyto alba', 'Coruja-da-igreja', 'Coruja-de-igreja']::text[]),
  (59, 'Coruja-orelhuda', 'Asio clamator', 'Corujas', 'incomum', ARRAY[]::text[]),
  (60, 'Murucututu', 'Pulsatrix perspicillata', 'Corujas', 'raro', ARRAY[]::text[]),
  (61, 'Garça-branca-grande', 'Ardea alba', 'Aves aquáticas', 'comum', ARRAY['Casmerodius albus']::text[]),
  (62, 'Garça-branca-pequena', 'Egretta thula', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (63, 'Garça-vaqueira', 'Bubulcus ibis', 'Aves aquáticas', 'comum', ARRAY['Ardea ibis']::text[]),
  (64, 'Garça-moura', 'Ardea cocoi', 'Aves aquáticas', 'incomum', ARRAY[]::text[]),
  (65, 'Maria-faceira', 'Syrigma sibilatrix', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (66, 'Socozinho', 'Butorides striata', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (67, 'Savacu', 'Nycticorax nycticorax', 'Aves aquáticas', 'incomum', ARRAY[]::text[]),
  (68, 'Socó-boi', 'Tigrisoma lineatum', 'Aves aquáticas', 'incomum', ARRAY[]::text[]),
  (69, 'Biguá', 'Nannopterum brasilianum', 'Aves aquáticas', 'comum', ARRAY['Phalacrocorax brasilianus', 'Nannopterum brasilianus', 'Phalacrocorax brasilianum']::text[]),
  (70, 'Colhereiro', 'Platalea ajaja', 'Aves aquáticas', 'incomum', ARRAY[]::text[]),
  (71, 'Guará', 'Eudocimus ruber', 'Aves aquáticas', 'raro', ARRAY[]::text[]),
  (72, 'Curicaca', 'Theristicus caudatus', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (73, 'Tuiuiú', 'Jabiru mycteria', 'Aves aquáticas', 'incomum', ARRAY[]::text[]),
  (74, 'Cabeça-seca', 'Mycteria americana', 'Aves aquáticas', 'incomum', ARRAY[]::text[]),
  (75, 'Pé-vermelho', 'Amazonetta brasiliensis', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (76, 'Irerê', 'Dendrocygna viduata', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (77, 'Frango-d''água-comum', 'Gallinula galeata', 'Aves aquáticas', 'comum', ARRAY['Gallinula chloropus']::text[]),
  (78, 'Saracura-três-potes', 'Aramides cajaneus', 'Aves aquáticas', 'incomum', ARRAY[]::text[]),
  (79, 'Jaçanã', 'Jacana jacana', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (80, 'Quero-quero', 'Vanellus chilensis', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (81, 'Pernilongo-de-costas-brancas', 'Himantopus melanurus', 'Aves aquáticas', 'incomum', ARRAY['Himantopus himantopus']::text[]),
  (82, 'Martim-pescador-grande', 'Megaceryle torquata', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (83, 'Martim-pescador-verde', 'Chloroceryle amazona', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (84, 'Martim-pescador-pequeno', 'Chloroceryle americana', 'Aves aquáticas', 'comum', ARRAY[]::text[]),
  (85, 'Gaivotão', 'Larus dominicanus', 'Aves marinhas', 'comum', ARRAY[]::text[]),
  (86, 'Fragata', 'Fregata magnificens', 'Aves marinhas', 'incomum', ARRAY['Tesourão']::text[]),
  (87, 'Atobá-marrom', 'Sula leucogaster', 'Aves marinhas', 'incomum', ARRAY[]::text[]),
  (88, 'Pinguim-de-magalhães', 'Spheniscus magellanicus', 'Aves marinhas', 'incomum', ARRAY[]::text[]),
  (89, 'Ema', 'Rhea americana', 'Aves terrestres', 'incomum', ARRAY[]::text[]),
  (90, 'Seriema', 'Cariama cristata', 'Aves terrestres', 'incomum', ARRAY[]::text[]),
  (91, 'Perdiz', 'Rhynchotus rufescens', 'Aves terrestres', 'incomum', ARRAY[]::text[]),
  (92, 'Codorna-amarela', 'Nothura maculosa', 'Aves terrestres', 'incomum', ARRAY[]::text[]),
  (93, 'Inhambu-chororó', 'Crypturellus parvirostris', 'Aves terrestres', 'incomum', ARRAY[]::text[]),
  (94, 'Macuco', 'Tinamus solitarius', 'Aves terrestres', 'raro', ARRAY[]::text[]),
  (95, 'Jacuaçu', 'Penelope obscura', 'Aves terrestres', 'incomum', ARRAY[]::text[]),
  (96, 'Jacutinga', 'Aburria jacutinga', 'Aves terrestres', 'raro', ARRAY[]::text[]),
  (97, 'Mutum-de-penacho', 'Crax fasciolata', 'Aves terrestres', 'raro', ARRAY[]::text[]),
  (98, 'Anu-preto', 'Crotophaga ani', 'Cucos e anus', 'comum', ARRAY[]::text[]),
  (99, 'Anu-branco', 'Guira guira', 'Cucos e anus', 'comum', ARRAY[]::text[]),
  (100, 'Alma-de-gato', 'Piaya cayana', 'Cucos e anus', 'comum', ARRAY[]::text[]),
  (101, 'Saci', 'Tapera naevia', 'Cucos e anus', 'incomum', ARRAY[]::text[]),
  (102, 'Udu-de-coroa-azul', 'Momotus momota', 'Aves de mata', 'incomum', ARRAY[]::text[]),
  (103, 'João-bobo', 'Nystalus chacuru', 'Aves de mata', 'incomum', ARRAY[]::text[]),
  (104, 'Surucuá-variado', 'Trogon surrucura', 'Aves de mata', 'incomum', ARRAY[]::text[]),
  (105, 'Bacurau', 'Nyctidromus albicollis', 'Aves de mata', 'comum', ARRAY[]::text[]),
  (106, 'Sabiá-laranjeira', 'Turdus rufiventris', 'Sabiás', 'comum', ARRAY[]::text[]),
  (107, 'Sabiá-barranco', 'Turdus leucomelas', 'Sabiás', 'comum', ARRAY[]::text[]),
  (108, 'Sabiá-poca', 'Turdus amaurochalinus', 'Sabiás', 'comum', ARRAY[]::text[]),
  (109, 'Sabiá-una', 'Turdus flavipes', 'Sabiás', 'incomum', ARRAY[]::text[]),
  (110, 'Sabiá-coleira', 'Turdus albicollis', 'Sabiás', 'incomum', ARRAY[]::text[]),
  (111, 'Sabiá-do-campo', 'Mimus saturninus', 'Sabiás', 'comum', ARRAY[]::text[]),
  (112, 'Sabiá-da-praia', 'Mimus gilvus', 'Sabiás', 'comum', ARRAY[]::text[]),
  (113, 'Sanhaço-cinzento', 'Thraupis sayaca', 'Sanhaços e saíras', 'comum', ARRAY[]::text[]),
  (114, 'Sanhaço-do-coqueiro', 'Thraupis palmarum', 'Sanhaços e saíras', 'comum', ARRAY[]::text[]),
  (115, 'Sanhaço-frade', 'Stephanophorus diadematus', 'Sanhaços e saíras', 'incomum', ARRAY[]::text[]),
  (116, 'Tiê-sangue', 'Ramphocelus bresilius', 'Sanhaços e saíras', 'incomum', ARRAY[]::text[]),
  (117, 'Tiê-preto', 'Tachyphonus coronatus', 'Sanhaços e saíras', 'comum', ARRAY[]::text[]),
  (118, 'Saí-azul', 'Dacnis cayana', 'Sanhaços e saíras', 'incomum', ARRAY[]::text[]),
  (119, 'Saíra-sete-cores', 'Tangara seledon', 'Sanhaços e saíras', 'incomum', ARRAY[]::text[]),
  (120, 'Saíra-amarela', 'Stilpnia cayana', 'Sanhaços e saíras', 'comum', ARRAY['Tangara cayana']::text[]),
  (121, 'Cambacica', 'Coereba flaveola', 'Sanhaços e saíras', 'comum', ARRAY[]::text[]),
  (122, 'Bem-te-vi', 'Pitangus sulphuratus', 'Pássaros', 'comum', ARRAY['Bem-te-vi-verdadeiro']::text[]),
  (123, 'Suiriri', 'Tyrannus melancholicus', 'Pássaros', 'comum', ARRAY[]::text[]),
  (124, 'Tesourinha', 'Tyrannus savana', 'Pássaros', 'comum', ARRAY[]::text[]),
  (125, 'Neinei', 'Megarynchus pitangua', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (126, 'Maria-cavaleira', 'Myiarchus ferox', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (127, 'Príncipe', 'Pyrocephalus rubinus', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (128, 'Viuvinha', 'Colonia colonus', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (129, 'Lavadeira-mascarada', 'Fluvicola nengeta', 'Pássaros', 'comum', ARRAY[]::text[]),
  (130, 'Freirinha', 'Arundinicola leucocephala', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (131, 'Bentevizinho-de-penacho-vermelho', 'Myiozetetes similis', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (132, 'Risadinha', 'Camptostoma obsoletum', 'Pássaros', 'comum', ARRAY[]::text[]),
  (133, 'João-de-barro', 'Furnarius rufus', 'Pássaros', 'comum', ARRAY['Forneiro']::text[]),
  (134, 'Casaca-de-couro', 'Pseudoseisura cristata', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (135, 'João-teneném', 'Synallaxis spixi', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (136, 'Choca-barrada', 'Thamnophilus doliatus', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (137, 'Choca-da-mata', 'Thamnophilus caerulescens', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (138, 'Graúna', 'Gnorimopsar chopi', 'Pássaros', 'comum', ARRAY[]::text[]),
  (139, 'Chupim', 'Molothrus bonariensis', 'Pássaros', 'comum', ARRAY['Vira-bosta']::text[]),
  (140, 'Japu', 'Psarocolius decumanus', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (141, 'Guaxe', 'Cacicus haemorrhous', 'Pássaros', 'comum', ARRAY[]::text[]),
  (142, 'Corrupião', 'Icterus jamacaii', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (143, 'Polícia-inglesa-do-sul', 'Leistes superciliaris', 'Pássaros', 'comum', ARRAY[]::text[]),
  (144, 'Andorinha-pequena-de-casa', 'Pygochelidon cyanoleuca', 'Pássaros', 'comum', ARRAY[]::text[]),
  (145, 'Andorinha-doméstica-grande', 'Progne chalybea', 'Pássaros', 'comum', ARRAY[]::text[]),
  (146, 'Andorinha-do-rio', 'Tachycineta albiventer', 'Pássaros', 'comum', ARRAY[]::text[]),
  (147, 'Corruíra', 'Troglodytes musculus', 'Pássaros', 'comum', ARRAY[]::text[]),
  (148, 'Uirapuru-verdadeiro', 'Cyphorhinus arada', 'Pássaros', 'lendario', ARRAY['Uirapuru']::text[]),
  (149, 'Pitiguari', 'Cyclarhis gujanensis', 'Pássaros', 'comum', ARRAY[]::text[]),
  (150, 'Tangará', 'Chiroxiphia caudata', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (151, 'Araponga', 'Procnias nudicollis', 'Pássaros', 'raro', ARRAY[]::text[]),
  (152, 'Pula-pula', 'Basileuterus culicivorus', 'Pássaros', 'comum', ARRAY[]::text[]),
  (153, 'Mariquita', 'Setophaga pitiayumi', 'Pássaros', 'comum', ARRAY[]::text[]),
  (154, 'Gralha-azul', 'Cyanocorax caeruleus', 'Pássaros', 'raro', ARRAY[]::text[]),
  (155, 'Gralha-do-campo', 'Cyanocorax cristatellus', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (156, 'Gralha-picaça', 'Cyanocorax chrysops', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (157, 'Coleirinho', 'Sporophila caerulescens', 'Pássaros', 'comum', ARRAY[]::text[]),
  (158, 'Curió', 'Sporophila angolensis', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (159, 'Bicudo', 'Sporophila maximiliani', 'Pássaros', 'raro', ARRAY[]::text[]),
  (160, 'Tiziu', 'Volatinia jacarina', 'Pássaros', 'comum', ARRAY[]::text[]),
  (161, 'Trinca-ferro', 'Saltator similis', 'Pássaros', 'comum', ARRAY[]::text[]),
  (162, 'Tico-tico', 'Zonotrichia capensis', 'Pássaros', 'comum', ARRAY[]::text[]),
  (163, 'Canário-da-terra', 'Sicalis flaveola', 'Pássaros', 'comum', ARRAY[]::text[]),
  (164, 'Cardeal', 'Paroaria coronata', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (165, 'Galo-da-campina', 'Paroaria dominicana', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (166, 'Azulão', 'Cyanoloxia brissonii', 'Pássaros', 'incomum', ARRAY[]::text[]),
  (167, 'Pardal', 'Passer domesticus', 'Pássaros', 'comum', ARRAY[]::text[]),
  (168, 'Bico-de-lacre', 'Estrilda astrild', 'Pássaros', 'comum', ARRAY[]::text[]),
  (169, 'Pintassilgo', 'Spinus magellanicus', 'Pássaros', 'incomum', ARRAY['Sporagra magellanica']::text[]),
  (170, 'Gaturamo-verdadeiro', 'Euphonia chlorotica', 'Pássaros', 'comum', ARRAY[]::text[])
ON CONFLICT (scientific_name) DO UPDATE SET
  common_name = EXCLUDED.common_name,
  grupo = EXCLUDED.grupo,
  rarity = EXCLUDED.rarity,
  aliases = EXCLUDED.aliases;

-- ---------------------------------------------------------------------------
-- Conquistas iniciais
-- ---------------------------------------------------------------------------

INSERT INTO achievements (code, title, description, icon, tier, metric, filter_value, threshold, sort_order) VALUES
  ('primeira-captura', 'Primeira captura', 'Capture a sua primeira ave.', 'Bird', 'bronze', 'total', '', 1, 10),
  ('colecionador-5', 'Observador iniciante', 'Capture 5 espécies diferentes.', 'Binoculars', 'bronze', 'total', '', 5, 20),
  ('colecionador-10', 'Observador dedicado', 'Capture 10 espécies diferentes.', 'Eye', 'prata', 'total', '', 10, 30),
  ('colecionador-25', 'Observador experiente', 'Capture 25 espécies diferentes.', 'Award', 'prata', 'total', '', 25, 40),
  ('colecionador-50', 'Mestre das aves', 'Capture 50 espécies diferentes.', 'Trophy', 'ouro', 'total', '', 50, 50),
  ('colecionador-100', 'Lenda da BirdDex', 'Capture 100 espécies diferentes.', 'Crown', 'ouro', 'total', '', 100, 60),
  ('incomum-1', 'Olhar atento', 'Capture uma ave incomum.', 'Sparkles', 'bronze', 'rarity', 'incomum', 1, 70),
  ('raro-1', 'Achado raro', 'Capture uma ave rara.', 'Gem', 'prata', 'rarity', 'raro', 1, 80),
  ('raro-5', 'Caçador de raridades', 'Capture 5 aves raras.', 'Target', 'ouro', 'rarity', 'raro', 5, 90),
  ('lendario-1', 'Lenda viva', 'Capture uma ave lendária.', 'Star', 'ouro', 'rarity', 'lendario', 1, 100),
  ('beija-flores-3', 'Rei do néctar', 'Capture 3 beija-flores.', 'Feather', 'prata', 'grupo', 'Beija-flores', 3, 110),
  ('papagaios-3', 'Revoada colorida', 'Capture 3 papagaios ou araras.', 'Flame', 'prata', 'grupo', 'Papagaios e araras', 3, 120),
  ('rapina-3', 'Olhos de águia', 'Capture 3 aves de rapina.', 'Shield', 'prata', 'grupo', 'Aves de rapina', 3, 130),
  ('corujas-2', 'Coruja da noite', 'Capture 2 corujas.', 'Moon', 'prata', 'grupo', 'Corujas', 2, 140),
  ('tucanos-2', 'Bico colorido', 'Capture 2 tucanos.', 'Medal', 'prata', 'grupo', 'Tucanos', 2, 150),
  ('pica-paus-2', 'Toc toc', 'Capture 2 pica-paus.', 'Hammer', 'bronze', 'grupo', 'Pica-paus', 2, 160),
  ('aquaticas-5', 'Pé na água', 'Capture 5 aves aquáticas.', 'Waves', 'prata', 'grupo', 'Aves aquáticas', 5, 170),
  ('sabias-3', 'Coro dos sabiás', 'Capture 3 espécies de sabiá.', 'Music', 'prata', 'grupo', 'Sabiás', 3, 180),
  ('sanhacos-3', 'Paleta de cores', 'Capture 3 sanhaços ou saíras.', 'Sparkles', 'bronze', 'grupo', 'Sanhaços e saíras', 3, 190),
  ('bem-te-vi', 'Bem-te-vi!', 'Capture o bem-te-vi.', 'Bird', 'bronze', 'species', 'Pitangus sulphuratus', 1, 200),
  ('joao-de-barro', 'O Engenheiro', 'Capture o joão-de-barro.', 'Hammer', 'bronze', 'species', 'Furnarius rufus', 1, 210),
  ('quero-quero', 'Sentinela do gramado', 'Capture o quero-quero.', 'Shield', 'bronze', 'species', 'Vanellus chilensis', 1, 220)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  tier = EXCLUDED.tier,
  metric = EXCLUDED.metric,
  filter_value = EXCLUDED.filter_value,
  threshold = EXCLUDED.threshold,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Captura: grava a espécie e libera conquistas na mesma transação
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.capture_bird(
  p_scientific_name text,
  p_common_name text,
  p_photo_url text DEFAULT '',
  p_location text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_species_id uuid;
  v_species public.bird_species%ROWTYPE;
  v_species_json jsonb;
  v_capture_id uuid;
  v_new jsonb;
  v_count integer;
  v_total integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '28000';
  END IF;

  v_species_id := public.match_bird_species(p_scientific_name, p_common_name);

  IF v_species_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_in_catalog', 'new_achievements', '[]'::jsonb);
  END IF;

  SELECT * INTO v_species FROM public.bird_species WHERE id = v_species_id;
  v_species_json := to_jsonb(v_species) - 'aliases';

  INSERT INTO public.user_captures (user_id, species_id, photo_url, location)
  VALUES (v_user, v_species_id, left(coalesce(p_photo_url, ''), 600), left(coalesce(p_location, ''), 200))
  ON CONFLICT (user_id, species_id) DO NOTHING
  RETURNING id INTO v_capture_id;

  SELECT count(*)::int INTO v_count FROM public.user_captures WHERE user_id = v_user;
  SELECT count(*)::int INTO v_total FROM public.bird_species;

  -- Já estava na coleção: nada a desbloquear.
  IF v_capture_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_captured',
      'species', v_species_json,
      'new_achievements', '[]'::jsonb,
      'captured_count', v_count,
      'dex_total', v_total
    );
  END IF;

  WITH unlocked AS (
    INSERT INTO public.user_achievements (user_id, achievement_code)
    SELECT v_user, a.code
    FROM public.achievements a
    WHERE public.achievement_progress(v_user, a.metric, a.filter_value) >= a.threshold
    ON CONFLICT (user_id, achievement_code) DO NOTHING
    RETURNING achievement_code
  )
  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.sort_order), '[]'::jsonb)
  INTO v_new
  FROM public.achievements a
  JOIN unlocked u ON u.achievement_code = a.code;

  RETURN jsonb_build_object(
    'status', 'captured',
    'species', v_species_json,
    'new_achievements', v_new,
    'captured_count', v_count,
    'dex_total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.capture_bird(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_bird(text, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Aproveita o histórico: publicações antigas com espécie viram capturas
-- (a primeira publicação de cada espécie por usuário) e liberam conquistas.
-- ---------------------------------------------------------------------------

INSERT INTO user_captures (user_id, species_id, photo_url, location, captured_at)
SELECT DISTINCT ON (p.user_id, m.species_id)
  p.user_id, m.species_id, coalesce(p.image_url, ''), coalesce(p.location, ''), p.created_at
FROM posts p
CROSS JOIN LATERAL (
  SELECT public.match_bird_species(p.species_scientific, p.species_name) AS species_id
) m
WHERE m.species_id IS NOT NULL
ORDER BY p.user_id, m.species_id, p.created_at ASC
ON CONFLICT (user_id, species_id) DO NOTHING;

INSERT INTO user_achievements (user_id, achievement_code)
SELECT u.user_id, a.code
FROM (SELECT DISTINCT user_id FROM user_captures) u
CROSS JOIN achievements a
WHERE public.achievement_progress(u.user_id, a.metric, a.filter_value) >= a.threshold
ON CONFLICT (user_id, achievement_code) DO NOTHING;
