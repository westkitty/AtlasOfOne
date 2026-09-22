import type { LocalAdventureScene } from './fallback';
import './FallbackAdventureCard.css';

export function FallbackAdventureCard({ scene }: { scene: LocalAdventureScene }) {
  return (
    <section className="fallback-adventure-card" data-testid="fallback-adventure" aria-label="Local adventure scene">
      <div className="fallback-adventure-kicker">LOCAL ADVENTURE · {scene.kicker}</div>
      <h2 data-testid="fallback-adventure-title">{scene.title}</h2>
      <p data-testid="fallback-adventure-body">{scene.body}</p>
      <div className="fallback-adventure-suggestions" aria-label="Possible approaches">
        {scene.suggestions.map((suggestion) => <span key={suggestion}>{suggestion}</span>)}
      </div>
      <p className="fallback-adventure-note">Runs on this device. A fictional choice is not evidence about you.</p>
    </section>
  );
}
