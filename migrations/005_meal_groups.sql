-- TN 3-level taxonomy: dish_category = meal group, dish_type = dish type

UPDATE dishes SET dish_category = CASE
  WHEN LOWER(dish_category) IN ('rice_staple', 'mixed_rice') THEN 'rice'
  WHEN LOWER(dish_category) IN ('kulambu', 'curry', 'sambar') THEN 'gravy'
  WHEN LOWER(dish_category) IN ('side_poriyal', 'protein') THEN 'side'
  WHEN LOWER(dish_category) = 'chutney' THEN 'chutney'
  WHEN LOWER(dish_category) = 'tiffin' THEN 'tiffin'
  WHEN dish_category IS NULL AND LOWER(dish_type) IN ('mixed_rice', 'biryani', 'pulao') THEN 'rice'
  WHEN dish_category IS NULL AND LOWER(dish_type) IN ('gravy', 'kulambu', 'kuzhambu', 'curry', 'sambar', 'rasam') THEN 'gravy'
  WHEN dish_category IS NULL AND LOWER(dish_type) IN ('side', 'fry', 'poriyal', 'roast', 'thoran', 'kootu', 'aviyal', 'protein') THEN 'side'
  WHEN dish_category IS NULL AND LOWER(dish_type) IN ('chutney', 'pachadi', 'thogayal') THEN 'chutney'
  WHEN dish_category IS NULL AND LOWER(dish_type) IN ('tiffin', 'idli', 'dosa', 'upma', 'pongal') THEN 'tiffin'
  WHEN dish_category IS NULL AND LOWER(dish_type) IN ('rice', 'staple', 'plain_rice') THEN 'rice'
  ELSE dish_category
END
WHERE dish_category IS NULL
   OR LOWER(dish_category) NOT IN ('rice', 'gravy', 'side', 'chutney', 'tiffin');

UPDATE dishes SET dish_type = CASE
  WHEN LOWER(dish_type) IN ('gravy', 'kuzhambu', 'kuzhambu_style') THEN 'kulambu'
  WHEN LOWER(dish_type) IN ('side', 'roast', 'thoran') THEN 'poriyal'
  WHEN LOWER(dish_type) = 'protein' THEN 'fry'
  WHEN LOWER(dish_type) IN ('rice', 'staple') THEN 'plain_rice'
  WHEN LOWER(dish_type) IN ('biryani', 'pulao') THEN 'mixed_rice'
  ELSE dish_type
END
WHERE dish_type IS NOT NULL
  AND LOWER(dish_type) NOT IN (
    'plain_rice', 'mixed_rice', 'kulambu', 'curry', 'sambar', 'rasam',
    'poriyal', 'fry', 'aviyal', 'kootu', 'thoran', 'chutney', 'pachadi',
    'thogayal', 'tiffin', 'idli', 'dosa', 'upma', 'pongal'
  );
