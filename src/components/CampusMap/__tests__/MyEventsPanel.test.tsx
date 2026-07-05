import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MyEventsPanel } from '../MyEventsPanel';
import type { MapEvent } from '../../../types/events';

const mk = (id: string, date: string): MapEvent => ({
  id,
  title: `E-${id}`,
  url: '',
  date,
  endDate: null,
  time: null,
  location: null,
  imageUrl: null,
  organizerKey: 'pef',
  societyId: 'supef',
  coord: [16.6, 49.2],
  roomCode: null,
  venueKind: 'offcampus',
  category: 'party',
});

describe('MyEventsPanel', () => {
  beforeEach(() => {
    // NOW is real; pick dates relative to today so the buckets are deterministic.
    const today = new Date();
    const iso = (d: number) => {
      const t = new Date(today);
      t.setDate(t.getDate() + d);
      return t.toISOString().slice(0, 10);
    };
    useAppStore.setState({
      mapMode: 'society',
      language: 'en',
      // NOTE: the third fixture uses id 'old' rather than 'past' — a title of
      // "E-past" would collide with the "Past" section heading under a
      // case-insensitive /past/i text match (getByText would find two nodes).
      societyMapEvents: [mk('old', iso(-3)), mk('live', iso(2)), mk('sched', iso(30))],
    });
  });

  it('groups own events into Live / Scheduled / Past', () => {
    render(<MyEventsPanel />);
    expect(screen.getByText('E-live')).toBeInTheDocument();
    expect(screen.getByText('E-sched')).toBeInTheDocument();
    expect(screen.getByText('E-old')).toBeInTheDocument();
    // headings present
    expect(screen.getByText(/live now/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/past/i)).toBeInTheDocument();
  });
});

describe('MyEventsPanel — EventRow rows, inline composer, logout', () => {
  beforeEach(() => {
    // Real strings, not translation keys: useTranslation() is not mocked in this
    // suite. With language 'cz', "map.createEvent" renders as "Vytvořit akci",
    // "admin.logout" as "Odhlásit", and the composer's name input placeholder is
    // "Název akce" — query those literal strings, not the i18n keys.
    useAppStore.setState({
      language: 'cz',
      adminAssociationId: 'supef',
      composerOpen: false,
      editEventId: null,
      societyMapEvents: [
        {
          id: 'e1',
          title: 'Spring Party',
          url: '',
          date: '2026-07-10',
          endDate: null,
          time: '20:00',
          location: 'Klub',
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.6, 49.2],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'party',
        },
      ],
      openComposer: vi.fn(),
      adminLogout: vi.fn(async () => {}),
    });
  });

  it('renders own events as rich rows with the thumbnail', () => {
    render(<MyEventsPanel />);
    expect(screen.getByText('Spring Party')).toBeInTheDocument();
    expect(document.querySelector('img[src="/emoji/1f389.svg"]')).toBeTruthy();
  });

  it('Create calls openComposer with no id', () => {
    const openComposer = vi.fn();
    useAppStore.setState({ openComposer });
    render(<MyEventsPanel />);
    screen.getByRole('button', { name: 'Vytvořit akci' }).click();
    expect(openComposer).toHaveBeenCalledWith();
  });

  it('shows the inline composer when composerOpen', () => {
    useAppStore.setState({ composerOpen: true, closeComposer: vi.fn() });
    render(<MyEventsPanel />);
    expect(screen.getByPlaceholderText('Název akce')).toBeInTheDocument();
  });

  it('logout calls adminLogout', () => {
    const adminLogout = vi.fn(async () => {});
    useAppStore.setState({ adminLogout });
    render(<MyEventsPanel />);
    screen.getByRole('button', { name: 'Odhlásit' }).click();
    expect(adminLogout).toHaveBeenCalledOnce();
  });
});
