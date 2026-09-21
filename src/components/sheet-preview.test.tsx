import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Engraver } from '../lib/engrave';
import { parseNotation } from '../lib/composition';
import { scoreFromLines } from '../lib/musicxml';
import { SheetPreview } from './sheet-preview';

/**
 * The preview is a frame around an engraver: it hands the score over, offers
 * print and download, and goes away. These tests give it a stand-in engraver
 * and check the frame — what it does before, after and instead of drawing.
 */
const SCORE = scoreFromLines(parseNotation('S R G m | P -'), 0, 'Etude', 80);

/** An engraver that draws nothing but records what it was asked to draw. */
function fakeEngraver() {
  const calls: string[] = [];
  const engrave: Engraver = async (container, xml) => {
    calls.push(xml);
    container.append('engraved');
  };
  return { calls, engrave };
}

describe('SheetPreview', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:sheet'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('engraves the score into the labelled container', async () => {
    const { calls, engrave } = fakeEngraver();
    render(
      <SheetPreview score={SCORE} title="Etude" onClose={() => {}} engrave={engrave} />,
    );

    const sheet = await screen.findByLabelText('sheet music');
    expect(sheet).toBeVisible();
    await waitFor(() => expect(sheet).toHaveTextContent('engraved'));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('<score-partwise');
    expect(calls[0]).toContain('Etude');
  });

  it('offers the MusicXML as a download and lets go of the object URL', async () => {
    const user = userEvent.setup();
    const { engrave } = fakeEngraver();
    render(
      <SheetPreview score={SCORE} title="Etude" onClose={() => {}} engrave={engrave} />,
    );
    await screen.findByLabelText('sheet music');

    await user.click(screen.getByRole('button', { name: 'download musicxml' }));

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toMatch(/xml/);
    expect(await blob.text()).toContain('<score-partwise');
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sheet'));
  });

  it('prints through the browser', async () => {
    const user = userEvent.setup();
    const { engrave } = fakeEngraver();
    render(
      <SheetPreview score={SCORE} title="Etude" onClose={() => {}} engrave={engrave} />,
    );
    await screen.findByLabelText('sheet music');

    await user.click(screen.getByRole('button', { name: 'print' }));

    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('closes on the button and on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { engrave } = fakeEngraver();
    render(
      <SheetPreview score={SCORE} title="Etude" onClose={onClose} engrave={engrave} />,
    );
    await screen.findByLabelText('sheet music');

    await user.click(screen.getByRole('button', { name: 'close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('says so when the engraver fails, rather than showing an empty frame', async () => {
    const engrave: Engraver = async () => {
      throw new Error('bad clef');
    };
    render(
      <SheetPreview score={SCORE} title="Etude" onClose={() => {}} engrave={engrave} />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be drawn/i);
  });

  it('refuses to engrave a stored score that declares a DOCTYPE', async () => {
    const { calls, engrave } = fakeEngraver();
    const tampered = {
      ...SCORE,
      musicXml: SCORE.musicXml.replace(
        '<score-partwise',
        '<!DOCTYPE x SYSTEM "http://evil/x.dtd"><score-partwise',
      ),
    };
    render(
      <SheetPreview
        score={tampered}
        title="Etude"
        onClose={() => {}}
        engrave={engrave}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/doctype/i);
    expect(calls).toHaveLength(0);
  });

  it('ignores an engraver that finishes after the preview has closed', async () => {
    let finish: () => void = () => {};
    const engrave: Engraver = (container) =>
      new Promise((resolve) => {
        finish = () => {
          container.append('late');
          resolve();
        };
      });
    const view = render(
      <SheetPreview score={SCORE} title="Etude" onClose={() => {}} engrave={engrave} />,
    );
    await screen.findByLabelText('sheet music');

    view.unmount();
    await act(async () => finish());
    // Nothing to assert on screen — the point is that this did not throw.
    expect(screen.queryByLabelText('sheet music')).toBeNull();
  });
});
