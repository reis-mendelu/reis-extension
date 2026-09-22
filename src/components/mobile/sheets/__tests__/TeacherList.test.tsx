import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TeacherList } from '../TeacherList';
import { useAppStore } from '../../../../store/useAppStore';

const EKONOMETRIE = [
  { name: 'doc. Ing. Václav Adamec, Ph.D.', id: '12162', roles: 'cvičící' },
  { name: 'Ing. Martin Baťka', id: '76293', roles: 'cvičící' },
  {
    name: 'doc. Ing. Luboš Střelec, Ph.D.',
    id: '2244',
    roles: 'cvičící, garant, přednášející, zkoušející',
  },
  { name: 'Ing. Terézia Vančová, Ph.D.', id: '50706', roles: 'cvičící' },
];

/**
 * The subject drawer printed every teacher as one comma-joined line under the
 * title — four names and their titles wrapping, nothing saying who runs the
 * course, and nothing to tap. A teacher is someone a student needs to reach,
 * and the person sheet (office, e-mail, phone) was one tap away with no way in.
 */
describe('TeacherList', () => {
  const pushSheet = vi.fn();

  beforeEach(() => {
    useAppStore.setState({ language: 'cz', pushSheet } as never);
  });
  afterEach(() => {
    cleanup();
    pushSheet.mockReset();
  });

  it('starts as one row that says how many teachers there are', () => {
    render(<TeacherList teachers={EKONOMETRIE} />);
    expect(screen.getByRole('button', { name: /Vyučující/ })).toHaveTextContent('4');
    expect(screen.queryByText('Ing. Martin Baťka')).not.toBeInTheDocument();
  });

  it('opens into groups by role, each teacher listed once', () => {
    render(<TeacherList teachers={EKONOMETRIE} />);
    fireEvent.click(screen.getByRole('button', { name: /Vyučující/ }));
    expect(screen.getByText('Garant')).toBeInTheDocument();
    expect(screen.getByText('Cvičící')).toBeInTheDocument();
    expect(screen.getAllByText('doc. Ing. Luboš Střelec, Ph.D.')).toHaveLength(1);
  });

  /**
   * A teacher opens their own page in IS (`clovek.pl`), not reIS's person
   * sheet: IS's page carries office hours, the full contact block and the
   * teacher's subjects, and the sheet showed little more than a room.
   * `target="_blank"` is what the Capacitor click listener in
   * `mobile/openExternal` intercepts to keep the IS session in-app.
   */
  it('links a teacher to their profile in IS', () => {
    render(<TeacherList teachers={EKONOMETRIE} />);
    fireEvent.click(screen.getByRole('button', { name: /Vyučující/ }));
    const link = screen.getByRole('link', { name: /Ing. Martin Baťka/ });
    expect(link).toHaveAttribute(
      'href',
      'https://is.mendelu.cz/auth/lide/clovek.pl?id=76293;lang=cz'
    );
    expect(link).toHaveAttribute('target', '_blank');
    fireEvent.click(link);
    expect(pushSheet).not.toHaveBeenCalled();
  });

  it('shows a teacher without an IS id, but not as something to tap', () => {
    render(<TeacherList teachers={[{ name: 'Host Lektor', id: null, roles: 'přednášející' }]} />);
    fireEvent.click(screen.getByRole('button', { name: /Vyučující/ }));
    expect(screen.getByText('Host Lektor')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Host Lektor/ })).not.toBeInTheDocument();
  });

  it('renders nothing when the syllabus names nobody', () => {
    const { container } = render(<TeacherList teachers={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
