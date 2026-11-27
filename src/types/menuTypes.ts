export interface DayMenu {
  date: string;
  soup: string | null;
  mainDishes: string[];
}

export interface OutletMenu {
  outlet: string;
  days: DayMenu[];
}

export interface PizzaItem {
  /** As SKM prints it, allergens dropped: "01. PIZZA POLLO". */
  name: string;
  /** The student price, in Kč. */
  price: number;
}

/**
 * The pizzeria at Zemědělská 1, the "Pizzerie" tab of SKM's jídelní lístek.
 * Unlike the canteens it has no days: it is the standing offer, so it is one
 * menu. `hours` are SKM's own lines, not parsed: the page words them freely
 * and differently per language.
 */
export interface PizzeriaMenu {
  address: string;
  hours: string[];
  pizzas: PizzaItem[];
}

/** Everything the SKM page gives for one language. */
export interface MenuPage {
  outlets: OutletMenu[];
  pizzeria: PizzeriaMenu | null;
}
