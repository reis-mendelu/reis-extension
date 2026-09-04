import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotificationItem } from '../NotificationItem';
import { DeadlineAlertItem } from '../DeadlineAlertItem';
import { useAppStore } from '../../../store/useAppStore';
import type { SpolekNotification } from '../../../services/spolky';
import type { DeadlineAlert } from '../../../hooks/useDeadlineAlerts';

const notification = {
  id: 'n1',
  associationId: 'esn',
  title: 'ESN Welcome Party v Boro',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  link: 'https://example.com/party',
} as SpolekNotification;

describe('notification rows', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  // The rows were two designs in one list: a 40px circle avatar indenting the
  // text to 136px on one, a 16px glyph indenting it to 88px on the other. The
  // avatar carried no information a student could read — every admin row was
  // the same bell — so the source becomes text on the row's own subtitle line,
  // and both kinds line up on one left edge.
  it('names the society that sent the notification', () => {
    render(<NotificationItem notification={notification} onClick={vi.fn()} />);
    expect(screen.getByText('ESN Mendelu')).toBeInTheDocument();
  });

  // The only way into an assignment was a 14px icon in the corner — under half
  // the 44px minimum, on the surface most likely to be used one-handed. The
  // row is the target.
  it('makes the whole deadline row open its link', () => {
    const alert: DeadlineAlert = {
      id: 'odev-1',
      type: 'assignment',
      title: 'Algoritmizace',
      body: 'Semestrální projekt',
      hoursUntil: 4,
      link: 'https://is.mendelu.cz/odevzdavarna',
    };
    render(<DeadlineAlertItem alert={alert} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://is.mendelu.cz/odevzdavarna');
    expect(link).toHaveTextContent('Algoritmizace');
  });
});

describe('deadline row copy', () => {
  const base = { id: 'd1', title: 'Matematika', body: 'Cvičný test 3 – derivace' };

  it('leads the subtitle with the kind when the meta column shows a time', () => {
    render(
      <DeadlineAlertItem
        alert={{ ...base, type: 'assignment', body: 'Semestrální projekt', hoursUntil: 4 }}
      />
    );
    expect(screen.getByText('Odevzdávárna · Semestrální projekt')).toBeInTheDocument();
  });

  // A practice test has no clock, so its kind is already the meta column. The
  // row printed "Cvičný test" three times: meta, subtitle prefix, and the
  // test's own name.
  it('does not repeat the kind when the meta column is the kind', () => {
    render(<DeadlineAlertItem alert={{ ...base, type: 'cvicny-test' }} />);
    expect(screen.getByText('Cvičný test 3 – derivace')).toBeInTheDocument();
    expect(screen.queryByText(/Cvičný test · /)).not.toBeInTheDocument();
  });
});
