// DE-Untertitel im Film-Modus, fest am unteren Bildrand ueber dem Player.
export default function Subtitle({ text }) {
  if (!text) return null;
  return (
    <div className="subtitle">
      <span className="subtitle-text">{text}</span>
    </div>
  );
}
