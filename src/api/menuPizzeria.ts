import type { PizzaItem, PizzeriaMenu } from '../types/menuTypes';

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** "86,00" → 86; null when it is not a price. */
function price(cell: Element | undefined): number | null {
  const n = parseFloat(clean(cell?.textContent).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** The text of the notice board, one entry per `<br>`/paragraph/line. */
function boardLines(board: Element): string[] {
  const copy = board.cloneNode(true) as Element;
  copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  copy.querySelectorAll('p').forEach((p) => p.append('\n'));
  return (copy.textContent ?? '').split('\n').map(clean).filter(Boolean);
}

/**
 * The pizzeria from SKM's menu page (`#pizzerie`), in either language, or null
 * when the tab is missing or lists no pizza — no menu rather than an empty one.
 *
 * Read against the real page (fixtures/skm-pizzerie.*.html). The student price
 * is found by its column header ("Student" / "Student" in the title attribute
 * of `.j-jedlik`), because the columns' order is SKM's.
 */
export function parsePizzeria(doc: Document): PizzeriaMenu | null {
  const root = doc.getElementById('pizzerie');
  const table = root?.querySelector('table.jidelnicek');
  if (!root || !table) return null;

  const headers = [...table.querySelectorAll('th')];
  const studentAt = headers.findIndex(
    (th) => th.querySelector('.j-jedlik')?.getAttribute('title') === 'Student'
  );
  if (studentAt < 0) return null;

  const pizzas: PizzaItem[] = [];
  for (const row of table.querySelectorAll('tr.jidlo')) {
    const name = clean(
      (row.querySelector('.j-nazev .j-slozeni') ?? row.querySelector('.j-nazev span'))?.textContent
    );
    // `th` count includes the empty first column, `td.j-cena` does not.
    const student = price([...row.querySelectorAll('.j-cena')][studentAt - 1]);
    if (name && student !== null) pizzas.push({ name, price: student });
  }
  if (pizzas.length === 0) return null;

  const board = root.querySelector('.notice-board');
  // First line is the title ("Pizzerie"), second the address, the rest hours.
  const [, address = '', ...rest] = board ? boardLines(board) : [];
  const hours = rest.filter((line) => !/:$/.test(line)).map((line) => line.replace(/[,.]$/, ''));
  return { address, hours, pizzas };
}
