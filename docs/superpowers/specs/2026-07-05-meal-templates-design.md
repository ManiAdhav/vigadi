# Vigadi — Meal Rules Redesign

**Status:** Implemented (v1)  
**Date:** 2026-07-05

## Problem with previous design

The old "Combo Rules" was a single static dropdown (`1 Kulambu + 2 Sides (Tamil Nadu)`). Real household rules are context-dependent, composed from slots, personal, and optionally balanced.

## Solution: Meal Templates

A **Template** = named, reusable rule that says *what kinds of dishes, how many, for which context*.

### Template structure

```typescript
Template {
  id: string
  name: string
  meal_slots: [breakfast | lunch | dinner]
  day_types: [school_day | holiday | any | custom]
  slots: DishSlot[]
  balance_target?: { carb: 50, veg: 30, protein: 20 }
}

DishSlot {
  category: tiffin | kulambu | mixed_rice | side_poriyal |
            protein | chutney | sambar | curry | rice_staple
  count: number
  options?: [category]   // OR slots
  note?: string
}
```

Dish categories are resolved from `dish_category` column (with fallback mapping from `dish_type`).

## Implementation

| Layer | Location |
|-------|----------|
| Shared types & presets | `shared/mealTemplates.ts` |
| DB migration | `migrations/003_meal_templates.sql` |
| Template CRUD | `server/db/templates.ts` |
| Template-based combo builder | `server/mealTemplateBuilder.ts` |
| API routes | `server.ts` — `/api/templates/*`, `/api/day-settings/*` |
| Template builder UI | `src/components/TemplateBuilder.tsx` |
| Discover screen | `src/components/KitchenView.tsx` |

### Presets shipped

- Tamil Nadu Lunch, School Day Breakfast/Lunch, Holiday Breakfast/Lunch
- Kerala Lunch, Classic Homestyle, High Protein Plate

### v1 behavior

- Auto-select template by day type + meal slot (Mon–Fri = school day)
- Template chips replace dropdown; "Auto" badge on matched template
- Unfilled slots shown with ingredient suggestions
- Duplicate/delete templates; manage via modal
- Tomorrow holiday override toggle

### Out of scope (v1)

- Balance target ring visualization
- Nutrition from dish macros
- Multi-day meal planning
- Per-person portions
