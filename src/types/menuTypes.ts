export interface DayMenu {
  date: string;
  soup: string | null;
  mainDishes: string[];
}

export interface OutletMenu {
  outlet: string;
  days: DayMenu[];
}
