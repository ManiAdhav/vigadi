import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import {
  STAPLE_DISHES,
  CATALOG_NAME_ALIASES,
  aliasesForDish,
  dishNameMatchesQuery,
  dishSearchRank,
} from "../../shared/staples";
import {
  dishCatalogTypeMatches,
  dishGroupMatchesSlotCategory,
} from "../../shared/mealTemplates";
import {
  memoryUpsertIngredient,
  memoryInsertDish,
  memorySearchDishes,
} from "../db/memoryStore";

const ingredientSlugs = new Set<string>(
  (
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "shared/ingredients.json"), "utf8")
    ) as Array<{ id: string }>
  ).map((i) => i.id)
);

/**
 * Dish names already in the shipped catalog. data/ is gitignored, so on a fresh
 * clone this file is absent — the checks that need it skip rather than fail.
 */
const catalogCsv = path.join(process.cwd(), "data/vigadi-dishes-final.csv");
const hasCatalogCsv = fs.existsSync(catalogCsv);
const catalogNames = new Set<string>(
  hasCatalogCsv
    ? fs
        .readFileSync(catalogCsv, "utf8")
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.split(",")[1]?.trim())
        .filter((name): name is string => Boolean(name))
    : []
);
const itWithCatalog = hasCatalogCsv ? it : it.skip;

describe("STAPLE_DISHES", () => {
  it("covers the plain staples the catalog never generated", () => {
    const names = STAPLE_DISHES.map((d) => d.name);
    expect(names).toContain("Sadam");
    expect(names).toContain("Idli");
    expect(names).toContain("Dosa");
    expect(names).toContain("Vevicha Muttai");
    expect(names).toContain("Muttai Omelette");
    expect(names).toContain("Thengai Chutney");
  });

  it("gives the chutney slot a default that is not tied to a vegetable", () => {
    const chutney = STAPLE_DISHES.find((d) => d.name === "Thengai Chutney")!;
    expect(chutney.ingredientSlug).toBe("coconut");
    expect(chutney.nameAliases).toContain("Coconut Chutney");
  });

  it("hangs every staple off an ingredient that exists in the catalog", () => {
    for (const dish of STAPLE_DISHES) {
      expect(ingredientSlugs, `${dish.name} → ${dish.ingredientSlug}`).toContain(
        dish.ingredientSlug
      );
    }
  });

  itWithCatalog("never duplicates a dish the catalog already ships", () => {
    for (const dish of STAPLE_DISHES) {
      expect(catalogNames, `${dish.name} is already in the catalog`).not.toContain(dish.name);
    }
  });

  it("gives every staple a group and category the slot matcher understands", () => {
    for (const dish of STAPLE_DISHES) {
      const row = {
        name: dish.name,
        dish_group: dish.dishGroup,
        dish_category: dish.dishCategory,
        english_alias: dish.englishAlias,
        dish_type: null,
      };
      expect(
        dishGroupMatchesSlotCategory(row, dish.expectSlotCategory),
        `${dish.name} should fill a ${dish.expectSlotCategory} slot`
      ).toBe(true);
    }
  });

  it("makes plain rice fill a plain_rice slot", () => {
    const sadam = STAPLE_DISHES.find((d) => d.name === "Sadam")!;
    expect(
      dishCatalogTypeMatches(
        {
          name: sadam.name,
          dish_group: sadam.dishGroup,
          dish_category: sadam.dishCategory,
          english_alias: sadam.englishAlias,
          dish_type: null,
        },
        "plain_rice"
      )
    ).toBe(true);
  });
});

describe("CATALOG_NAME_ALIASES", () => {
  itWithCatalog("only aliases dishes that actually exist in the catalog", () => {
    for (const name of Object.keys(CATALOG_NAME_ALIASES)) {
      expect(catalogNames, `${name} is not a catalog dish`).toContain(name);
    }
  });

  it("maps the English names Mani's household types", () => {
    expect(CATALOG_NAME_ALIASES["Muttai Podimas"]).toContain("Egg Podimas");
    expect(CATALOG_NAME_ALIASES["Toor Dal Sambar"]).toContain("Sambar");
    expect(CATALOG_NAME_ALIASES["Chapati"]).toContain("Chappathi");
    expect(CATALOG_NAME_ALIASES["Paruppu Rasam"]).toContain("Rasam");
  });

  itWithCatalog("has no alias that collides with a different dish's real name", () => {
    for (const [dish, aliases] of Object.entries(CATALOG_NAME_ALIASES)) {
      for (const alias of aliases) {
        if (alias === dish) continue;
        expect(catalogNames, `alias "${alias}" on ${dish} shadows a real dish`).not.toContain(
          alias
        );
      }
    }
  });
});

describe("aliasesForDish", () => {
  it("returns the staple's own aliases", () => {
    expect(aliasesForDish("Sadam")).toContain("Rice");
  });

  it("returns aliases for an existing catalog dish", () => {
    expect(aliasesForDish("Muttai Podimas")).toContain("Egg Podimas");
  });

  it("returns an empty list for anything unknown", () => {
    expect(aliasesForDish("Nonexistent Dish")).toEqual([]);
  });
});

describe("dishNameMatchesQuery", () => {
  const podimas = { name: "Muttai Podimas", name_aliases: ["Egg Podimas", "Egg Bhurji"] };

  it("matches on the real name", () => {
    expect(dishNameMatchesQuery(podimas, "muttai podimas")).toBe(true);
  });

  it("matches on an alias", () => {
    expect(dishNameMatchesQuery(podimas, "Egg Podimas")).toBe(true);
  });

  it("matches a partial alias the way the name search does", () => {
    expect(dishNameMatchesQuery(podimas, "bhurji")).toBe(true);
  });

  it("does not match an unrelated query", () => {
    expect(dishNameMatchesQuery(podimas, "sambar")).toBe(false);
  });

  it("tolerates a dish with no aliases", () => {
    expect(dishNameMatchesQuery({ name: "Kal Dosa", name_aliases: null }, "kal")).toBe(true);
    expect(dishNameMatchesQuery({ name: "Kal Dosa", name_aliases: null }, "idli")).toBe(false);
  });
});

describe("offline dish search (memory store)", () => {
  // Proves the wiring, not just the matcher: insert through the real insert
  // path, search through the real search path.
  const ingredientId = memoryUpsertIngredient("Egg");
  const riceId = memoryUpsertIngredient("Rice");

  memoryInsertDish({
    ingredientId,
    name: "Muttai Podimas",
    nameAliases: CATALOG_NAME_ALIASES["Muttai Podimas"],
  });
  memoryInsertDish({ ingredientId, name: "Muttai Kurma", nameAliases: ["Egg Kurma"] });
  memoryInsertDish({ ingredientId: riceId, name: "Beetroot Rice (Beetroot Sadam)" });
  memoryInsertDish({ ingredientId: riceId, name: "Elumichai Sadam (Lemon Rice)" });
  memoryInsertDish({
    ingredientId: riceId,
    name: "Sadam",
    nameAliases: STAPLE_DISHES.find((d) => d.name === "Sadam")!.nameAliases,
  });

  it("finds Muttai Podimas when you type Egg Podimas", () => {
    const hits = memorySearchDishes("Egg Podimas", 5);
    expect(hits[0]?.name).toBe("Muttai Podimas");
  });

  it("finds plain rice first when you type Rice", () => {
    const hits = memorySearchDishes("Rice", 5);
    expect(hits[0]?.name).toBe("Sadam");
  });

  it("still finds the variety rices further down", () => {
    const names = memorySearchDishes("Rice", 5).map((d) => d.name);
    expect(names).toContain("Beetroot Rice (Beetroot Sadam)");
  });

  it("does not invent matches", () => {
    expect(memorySearchDishes("Biryani", 5)).toHaveLength(0);
  });
});

describe("dishSearchRank", () => {
  const sadam = { name: "Sadam", name_aliases: ["Rice", "Plain Rice", "Steamed Rice"] };
  const beetrootRice = { name: "Beetroot Rice (Beetroot Sadam)", name_aliases: null };

  it("ranks plain rice above the variety rices when you type Rice", () => {
    expect(dishSearchRank(sadam, "Rice")).toBeLessThan(dishSearchRank(beetrootRice, "Rice"));
  });

  it("treats an exact alias hit as an exact match", () => {
    expect(dishSearchRank(sadam, "rice")).toBe(0);
  });

  it("ranks a name prefix above a mid-name match", () => {
    expect(dishSearchRank({ name: "Idli Upma", name_aliases: null }, "idli")).toBeLessThan(
      dishSearchRank({ name: "Podi Idli", name_aliases: null }, "idli")
    );
  });

  it("ranks the plain staple first for its own name", () => {
    const idli = { name: "Idli", name_aliases: ["Idly", "Plain Idli"] };
    for (const variant of ["Rava Idli", "Kanchipuram Idli", "Podi Idli", "Idli Upma"]) {
      expect(
        dishSearchRank(idli, "Idli"),
        `Idli should outrank ${variant}`
      ).toBeLessThan(dishSearchRank({ name: variant, name_aliases: null }, "Idli"));
    }
  });
});
