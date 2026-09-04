/**
 * A perforated output grille, as on the reference hardware. It doubles as the
 * output indicator: the mesh dims when the level is at zero.
 */
export function SpeakerGrille({ muted }: { muted: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="keycap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-graphite bg-none"
    >
      <span
        className="h-[30px] w-[30px] rounded-full transition-opacity duration-200"
        style={{
          opacity: muted ? 0.25 : 0.75,
          backgroundImage:
            'radial-gradient(circle, rgba(250,250,250,0.85) 0.7px, transparent 0.9px)',
          backgroundSize: '3.2px 3.2px',
        }}
      />
    </div>
  );
}
