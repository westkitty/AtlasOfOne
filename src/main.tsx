import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { VoiceLab } from './voice/VoiceLab';
import './styles.css';

/**
 * `?voice-lab=1` opens a development-only voice audition surface INSTEAD of the
 * game. It is mounted here rather than inside `App` so it sits in front of the
 * cold open — the lab is a tool, not a screen of Atlas, and ordinary play can
 * never reach it.
 */
const isVoiceLab = new URLSearchParams(window.location.search).get('voice-lab') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isVoiceLab ? <VoiceLab /> : <App />}</StrictMode>
);
