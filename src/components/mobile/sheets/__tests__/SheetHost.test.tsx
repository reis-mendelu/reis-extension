import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SheetHost } from '../SheetHost';
import { useAppStore } from '../../../../store/useAppStore';

describe('SheetHost', () => {
  beforeEach(() => {
    useAppStore.setState({
      mobileSheets: [],
      language: 'cz',
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: { version: 1, lastUpdated: '', data: {} },
    } as never);
  });

  it('renders nothing for an empty stack', () => {
    const { container } = render(<SheetHost />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the top sheet of the stack', () => {
    useAppStore.setState({
      mobileSheets: [{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' }],
    } as never);
    render(<SheetHost />);
    expect(screen.getByText('Algoritmizace')).toBeInTheDocument();
  });

  it('renders two stacked sheets, with the later one above', () => {
    useAppStore.setState({
      mobileSheets: [
        { kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' },
        { kind: 'subjectDrawer', courseCode: 'MAT', courseName: 'Matematika' },
      ],
    } as never);
    render(<SheetHost />);

    const panels = screen.getAllByTestId('sheet-panel');
    expect(panels).toHaveLength(2);
    expect(screen.getByText('Algoritmizace')).toBeInTheDocument();
    expect(screen.getByText('Matematika')).toBeInTheDocument();
    // Both sheets share the same (non-elevated) z-index — later DOM order
    // is what puts the second sheet visually above the first.
    expect(panels[1]!.textContent).toContain('Matematika');
  });

  /**
   * `studyPlan` rather than `subjectDrawer`: the drawer presents as a SCREEN
   * now (Sheet variant="screen") and deliberately renders no backdrop, so it
   * can no longer stand in for "a sheet with a backdrop". The behaviour under
   * test — one backdrop click pops exactly one level — is unchanged.
   */
  it('pops exactly one sheet when a backdrop is clicked', () => {
    useAppStore.setState({
      mobileSheets: [{ kind: 'studyPlan' }, { kind: 'studyPlan' }],
    } as never);
    render(<SheetHost />);

    const backdrops = screen.getAllByTestId('sheet-backdrop');
    fireEvent.click(backdrops[backdrops.length - 1]!);

    expect(useAppStore.getState().mobileSheets).toHaveLength(1);
  });

  it('renders nothing for an unknown sheet kind', () => {
    // 'confirm' is a real MobileSheet kind but has no SheetHost renderer yet
    // (ConfirmSheet self-mounts inside ExamsScreen instead) — it stands in
    // here for "kind SheetHost doesn't know how to render".
    useAppStore.setState({ mobileSheets: [{ kind: 'confirm', confirmId: 'x' }] } as never);
    const { container } = render(<SheetHost />);
    expect(container).toBeEmptyDOMElement();
  });
});
