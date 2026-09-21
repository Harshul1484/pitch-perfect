/**
 * Draw a score into an element.
 *
 * The one place the engraving library is named. It is loaded when a sheet is
 * first opened and not before: OpenSheetMusicDisplay is the largest thing
 * this app could ship, and most sessions never open a sheet — the tuner does
 * not know it exists. Anything that draws a score takes an Engraver, and the
 * preview takes this one by default, so tests can hand it a stand-in and never
 * pull the library in at all.
 */
export type Engraver = (container: HTMLElement, musicXml: string) => Promise<void>;

export const engraveWithOsmd: Engraver = async (container, musicXml) => {
  const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');

  const osmd = new OpenSheetMusicDisplay(container, {
    backend: 'svg',
    autoResize: false,
    drawTitle: true,
    drawComposer: false,
    drawPartNames: false,
    drawingParameters: 'compacttight',
  });

  await osmd.load(musicXml);
  osmd.render();
};
