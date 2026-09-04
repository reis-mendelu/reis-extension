import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../useAppStore';
import type { SearchResult } from '../../../components/SearchBar/types';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

function person(id: string, title: string): SearchResult {
  return { id, title, type: 'person', personType: 'student' };
}

function subject(id: string, title: string): SearchResult {
  return { id, title, type: 'subject' };
}

describe('createSearchSlice — recent searches', () => {
  beforeEach(() => {
    useAppStore.setState({ recentSearches: [], recentPeople: [] } as never);
  });

  it('still shows the three most recent of anything in the search dropdowns', async () => {
    const { saveRecentSearch } = useAppStore.getState();
    for (let i = 0; i < 5; i++)
      await saveRecentSearch(subject(String(i), `Subject ${i}`), 'Předmět');

    const recent = useAppStore.getState().recentSearches;
    expect(recent.length).toBe(3);
    expect(recent[0]?.title).toBe('Subject 4');
  });

  it('remembers people in their own list, so page searches cannot evict them', async () => {
    // THE bug: with one mixed three-deep history, looking up three IS pages
    // wiped every person the student had searched, and the phone's Lidé tab
    // went blank.
    const { saveRecentSearch } = useAppStore.getState();
    await saveRecentSearch(person('77', 'Dominik Holek'), 'Student');
    for (let i = 0; i < 4; i++)
      await saveRecentSearch(subject(String(i), `Subject ${i}`), 'Předmět');

    expect(useAppStore.getState().recentSearches.map((r) => r.title)).not.toContain(
      'Dominik Holek'
    );
    expect(useAppStore.getState().recentPeople.map((r) => r.title)).toEqual(['Dominik Holek']);
  });

  it("keeps a person's role as their detail, not the recency label", async () => {
    // The people list sits under a "Naposledy hledaní" heading; repeating
    // "Nedávno hledáno" on every row says nothing, while the role tells you
    // which Novák you are looking at.
    const { saveRecentSearch } = useAppStore.getState();
    await saveRecentSearch({ ...person('1', 'Jan Novák'), detail: 'Vyučující' }, 'Nedávno hledáno');

    expect(useAppStore.getState().recentPeople[0]?.detail).toBe('Vyučující');
    expect(useAppStore.getState().recentSearches[0]?.detail).toBe('Nedávno hledáno');
  });

  it('keeps students as readily as teachers — every person searched', async () => {
    const { saveRecentSearch } = useAppStore.getState();
    await saveRecentSearch({ ...person('1', 'Jan Novák'), personType: 'teacher' }, 'Vyučující');
    await saveRecentSearch(person('77', 'Dominik Holek'), 'Student');

    expect(useAppStore.getState().recentPeople.map((r) => r.title)).toEqual([
      'Dominik Holek',
      'Jan Novák',
    ]);
  });

  it('caps the people list so it cannot grow without bound', async () => {
    const { saveRecentSearch } = useAppStore.getState();
    for (let i = 0; i < 20; i++) await saveRecentSearch(person(String(i), `Osoba ${i}`), 'Student');

    expect(useAppStore.getState().recentPeople.length).toBe(8);
    expect(useAppStore.getState().recentPeople[0]?.title).toBe('Osoba 19');
  });

  it('moves a person already in the list to the front instead of duplicating them', async () => {
    const { saveRecentSearch } = useAppStore.getState();
    await saveRecentSearch(person('1', 'Jan Novák'), 'Student');
    await saveRecentSearch(person('2', 'Eva Malá'), 'Student');
    await saveRecentSearch(person('1', 'Jan Novák'), 'Student');

    expect(useAppStore.getState().recentPeople.map((r) => r.title)).toEqual([
      'Jan Novák',
      'Eva Malá',
    ]);
  });

  it('does not let a slow hydration overwrite a search made while it was in flight', async () => {
    // loadRecentSearches resolves whenever IndexedDB gets round to it. A person
    // searched in the meantime is newer than the stored copy, and letting the
    // hydration win would drop them — permanently, once the next save persists
    // the stale list.
    const { IndexedDBService } = await import('../../../services/storage');
    vi.mocked(IndexedDBService.get).mockResolvedValue([person('9', 'Stará Osoba')] as never);

    const hydration = useAppStore.getState().loadRecentSearches();
    await useAppStore.getState().saveRecentSearch(person('77', 'Dominik Holek'), 'Student');
    await hydration;

    expect(useAppStore.getState().recentPeople.map((r) => r.title)).toEqual(['Dominik Holek']);
    vi.mocked(IndexedDBService.get).mockResolvedValue(null as never);
  });

  it('keeps two different people who happen to share a name', async () => {
    // Deduping by title collapsed namesakes into one entry, and IS has plenty —
    // the id is what identifies a person.
    const { saveRecentSearch } = useAppStore.getState();
    await saveRecentSearch(person('1', 'Jan Novák'), 'Student');
    await saveRecentSearch(person('2', 'Jan Novák'), 'Vyučující');

    expect(useAppStore.getState().recentPeople.length).toBe(2);
  });
});

describe('createSearchSlice — recent subjects', () => {
  beforeEach(() => {
    useAppStore.setState({ recentSearches: [], recentPeople: [], recentSubjects: [] } as never);
  });

  // Lidé keeps its own history; Předměty had none, so opening the search sheet
  // on the subject side showed an empty screen until something was typed —
  // even though the same subjects get looked up over and over.
  it('remembers subjects in their own list, deeper than the mixed history', async () => {
    const { saveRecentSearch } = useAppStore.getState();
    for (let i = 0; i < 5; i++)
      await saveRecentSearch(subject(String(i), `Subject ${i}`), 'Předmět');

    const recent = useAppStore.getState().recentSubjects;
    expect(recent.map((r) => r.title)).toEqual([
      'Subject 4',
      'Subject 3',
      'Subject 2',
      'Subject 1',
      'Subject 0',
    ]);
  });

  it('does not let people into the subject list, or subjects into the people list', async () => {
    const { saveRecentSearch } = useAppStore.getState();
    await saveRecentSearch(person('77', 'Dominik Holek'), 'Student');
    await saveRecentSearch(subject('ALG', 'Algoritmizace'), 'Předmět');

    expect(useAppStore.getState().recentSubjects.map((r) => r.title)).toEqual(['Algoritmizace']);
    expect(useAppStore.getState().recentPeople.map((r) => r.title)).toEqual(['Dominik Holek']);
  });

  it('moves a subject looked up again back to the front instead of duplicating it', async () => {
    const { saveRecentSearch } = useAppStore.getState();
    await saveRecentSearch(subject('ALG', 'Algoritmizace'), 'Předmět');
    await saveRecentSearch(subject('MAT', 'Matematika'), 'Předmět');
    await saveRecentSearch(subject('ALG', 'Algoritmizace'), 'Předmět');

    expect(useAppStore.getState().recentSubjects.map((r) => r.title)).toEqual([
      'Algoritmizace',
      'Matematika',
    ]);
  });
});
