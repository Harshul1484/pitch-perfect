import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Engraver } from '../lib/engrave';
import { parseNotation } from '../lib/composition';
import { scoreFromLines } from '../lib/musicxml';
import type { recognizeSheet } from '../lib/omr-client';
import { SheetImport } from './sheet-import';

/**
 * Pick, scan, review, create — and every way out of it. The recogniser is a
 * stand-in, so what is tested is the flow around it: what is refused before
 * a byte is sent, what is shown for correction, and what is finally written.
 */
const ENDPOINT = 'https://omr.example';

/** A scan the stand-in recogniser will answer with: two bars in G. */
const RECOGNISED = scoreFromLines(
  parseNotation('S R G m | P - - -'),
  7,
  'Etude',
  96,
).musicXml;

const png = () => new File([new Uint8Array(64)], 'scan.png', { type: 'image/png' });
const svg = () => new File(['<svg/>'], 'scan.svg', { type: 'image/svg+xml' });

const engrave: Engraver = async (container) => {
  container.append('engraved');
};

function setup(overrides: Partial<Parameters<typeof SheetImport>[0]> = {}) {
  const recognize = vi.fn<typeof recognizeSheet>(async () => ({
    musicXml: RECOGNISED,
    warnings: ['The second staff line was faint.'],
  }));
  const onCreate = vi.fn(async () => 'new-id');
  const onClose = vi.fn();

  render(
    <SheetImport
      tonic={0}
      endpoint={ENDPOINT}
      onCreate={onCreate}
      onClose={onClose}
      recognize={recognize}
      engrave={engrave}
      {...overrides}
    />,
  );

  return { recognize, onCreate, onClose };
}

const pick = () => screen.getByLabelText('sheet file');

describe('SheetImport', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:scan'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses a file it cannot scan before anything is sent', async () => {
    // The picker's accept filter is the first line; this tests the second, for
    // a file that arrives past it — dropped in, or from a picker that ignores
    // the filter.
    const user = userEvent.setup({ applyAccept: false });
    const { recognize } = setup();

    await user.upload(pick(), svg());

    expect(screen.getByRole('alert')).toHaveTextContent('PNG, JPEG, WebP, or PDF');
    expect(screen.queryByRole('button', { name: 'scan sheet' })).toBeNull();
    expect(recognize).not.toHaveBeenCalled();
  });

  it('shows the picked file and sends it only when asked', async () => {
    const user = userEvent.setup();
    const { recognize } = setup();

    await user.upload(pick(), png());

    expect(screen.getByRole('img', { name: /scan\.png/ })).toHaveAttribute(
      'src',
      'blob:scan',
    );
    expect(recognize).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'scan sheet' }));

    expect(recognize).toHaveBeenCalledTimes(1);
    const [file, endpoint] = recognize.mock.calls[0];
    expect(file.name).toBe('scan.png');
    expect(endpoint).toBe(ENDPOINT);
  });

  it('shows the result for review: title, notation, the score, and what to check', async () => {
    const user = userEvent.setup();
    setup();

    await user.upload(pick(), png());
    await user.click(screen.getByRole('button', { name: 'scan sheet' }));

    expect(await screen.findByLabelText('title')).toHaveValue('Etude');
    // The key signature put Sa on G, and the notes read against it.
    expect(screen.getByLabelText('tonic')).toHaveValue('7');
    expect(screen.getByLabelText('notation')).toHaveValue('S R G m | P - - -');
    expect(screen.getByLabelText('sheet music')).toHaveTextContent('engraved');
    expect(screen.getByRole('list', { name: 'check these' })).toHaveTextContent(
      'The second staff line was faint.',
    );
  });

  it('reads the notes against a different Sa when asked', async () => {
    const user = userEvent.setup();
    setup();

    await user.upload(pick(), png());
    await user.click(screen.getByRole('button', { name: 'scan sheet' }));
    await screen.findByLabelText('notation');

    await user.selectOptions(screen.getByLabelText('tonic'), '0');

    // G A B C | D against C as Sa: P D N S' | R'.
    expect(screen.getByLabelText('notation')).toHaveValue("P D N S' | R' - - -");
  });

  it('creates the piece from the corrected notation, with the score, in one write', async () => {
    const user = userEvent.setup();
    const { onCreate, onClose } = setup();

    await user.upload(pick(), png());
    await user.click(screen.getByRole('button', { name: 'scan sheet' }));

    const title = await screen.findByLabelText('title');
    await user.clear(title);
    await user.type(title, 'Etude in G');

    const notation = screen.getByLabelText('notation');
    await user.clear(notation);
    await user.type(notation, 'S R G m | P - - - | S');

    await user.click(screen.getByRole('button', { name: 'create piece' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const [createdTitle, tonic, contents] = onCreate.mock.calls[0] as unknown as [
      string,
      number,
      { notation: string; score: { source: string; musicXml: string; tempo: number } },
    ];
    expect(createdTitle).toBe('Etude in G');
    expect(tonic).toBe(7);
    expect(contents.notation).toBe('S R G m | P - - - | S');
    expect(contents.score.source).toBe('imported');
    expect(contents.score.tempo).toBe(96);
    expect(contents.score.musicXml).toContain('<score-partwise');
    // Never the file, never its preview URL.
    expect(JSON.stringify(contents)).not.toContain('blob:');
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the picked file when the scan fails, and says why', async () => {
    const user = userEvent.setup();
    const recognize = vi.fn<typeof recognizeSheet>(async () => {
      throw new Error('The recognition service could not be reached.');
    });
    setup({ recognize });

    await user.upload(pick(), png());
    await user.click(screen.getByRole('button', { name: 'scan sheet' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached');
    expect(screen.getByRole('img', { name: /scan\.png/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'scan sheet' })).toBeEnabled();
  });

  it('refuses a scan that came back as more than one part', async () => {
    const user = userEvent.setup();
    const recognize = vi.fn<typeof recognizeSheet>(async () => ({
      musicXml: RECOGNISED.replace(
        '</part>',
        '</part><part id="P2"><measure number="1"/></part>',
      ),
      warnings: [],
    }));
    setup({ recognize });

    await user.upload(pick(), png());
    await user.click(screen.getByRole('button', { name: 'scan sheet' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/one part|single/i);
  });

  it('lets go of the preview URL when cancelled', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();

    await user.upload(pick(), png());
    await user.click(screen.getByRole('button', { name: 'cancel' }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:scan');
    expect(onClose).toHaveBeenCalled();
  });

  it('lets go of the preview URL when a different file is picked', async () => {
    const user = userEvent.setup();
    setup();

    await user.upload(pick(), png());
    await user.upload(pick(), png());

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:scan');
  });

  it('says recognition is not set up when there is no endpoint', async () => {
    const user = userEvent.setup();
    const { recognize } = setup({ endpoint: '' });

    await user.upload(pick(), png());

    expect(screen.getByRole('alert')).toHaveTextContent(/not set up/i);
    expect(screen.queryByRole('button', { name: 'scan sheet' })).toBeNull();
    expect(recognize).not.toHaveBeenCalled();
  });
});
