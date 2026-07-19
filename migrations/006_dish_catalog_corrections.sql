-- Ven Pongal is a tiffin, not a side dish.
UPDATE dishes
SET dish_type = 'tiffin',
    dish_category = 'tiffin'
WHERE LOWER(name) = 'ven pongal';

-- Poori Masala is served with poori, not rice.
UPDATE dishes
SET pairs_with = '["Poori"]'::jsonb
WHERE LOWER(name) = 'poori masala';
