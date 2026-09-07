import { describe, expect, it } from 'vitest';
import { parseVoiceCommand } from '../../src/voice/commands';

describe('voice agency commands parser', () => {
  it('recognizes PASS command variants', () => {
    expect(parseVoiceCommand('pass')?.type).toBe('pass');
    expect(parseVoiceCommand('Skip')?.type).toBe('pass');
    expect(parseVoiceCommand('next question.')?.type).toBe('pass');
    expect(parseVoiceCommand('pass question!')?.type).toBe('pass');
  });

  it('recognizes PRIVATE command variants', () => {
    expect(parseVoiceCommand('private')?.type).toBe('private');
    expect(parseVoiceCommand('Mark Private.')?.type).toBe('private');
    expect(parseVoiceCommand('keep this private!')?.type).toBe('private');
    expect(parseVoiceCommand("don't ask about this")?.type).toBe('private');
    expect(parseVoiceCommand('never ask about this.')?.type).toBe('private');
  });

  it('recognizes STOP command variants', () => {
    expect(parseVoiceCommand('stop')?.type).toBe('stop');
    expect(parseVoiceCommand('Pause!')?.type).toBe('stop');
    expect(parseVoiceCommand('hold on...')?.type).toBe('stop');
    expect(parseVoiceCommand('pause session')?.type).toBe('stop');
    expect(parseVoiceCommand('quiet')?.type).toBe('stop');
  });

  it('recognizes SERIOUS command variants', () => {
    expect(parseVoiceCommand('serious')?.type).toBe('serious');
    expect(parseVoiceCommand('serious mode.')?.type).toBe('serious');
    expect(parseVoiceCommand('quiet mode')?.type).toBe('serious');
    expect(parseVoiceCommand('be serious!')?.type).toBe('serious');
    expect(parseVoiceCommand('no fanfare')?.type).toBe('serious');
  });

  it('recognizes HELP command variants', () => {
    expect(parseVoiceCommand('help')?.type).toBe('help');
    expect(parseVoiceCommand('what do i do?')?.type).toBe('help');
    expect(parseVoiceCommand('how does this work')?.type).toBe('help');
  });

  it('recognizes SASS tuning commands', () => {
    expect(parseVoiceCommand('sass low')?.type).toBe('sass-low');
    expect(parseVoiceCommand('low sass')?.type).toBe('sass-low');
    expect(parseVoiceCommand('gentle sass')?.type).toBe('sass-low');
    expect(parseVoiceCommand('sass medium')?.type).toBe('sass-medium');
    expect(parseVoiceCommand('medium sass')?.type).toBe('sass-medium');
    expect(parseVoiceCommand('sass risks')?.type).toBe('sass-risks');
    expect(parseVoiceCommand('risks understood')?.type).toBe('sass-risks');
    expect(parseVoiceCommand('high sass')?.type).toBe('sass-risks');
    expect(parseVoiceCommand('i understand the risks')?.type).toBe('sass-risks');
  });

  it('does NOT match natural conversational answers that contain command words', () => {
    // Normal sentences containing 'pass', 'private', 'stop', 'serious', etc. must not be intercepted
    expect(parseVoiceCommand('I passed by the library on my way home.')).toBeNull();
    expect(parseVoiceCommand('My private life is kept separate from work.')).toBeNull();
    expect(parseVoiceCommand('I cannot easily stop once I get started on a project.')).toBeNull();
    expect(parseVoiceCommand('I take my responsibilities very serious.')).toBeNull();
    expect(parseVoiceCommand('I often ask for help when learning a new tool.')).toBeNull();
    expect(parseVoiceCommand('I enjoy gentle humor and light banter.')).toBeNull();
    expect(parseVoiceCommand('I try to pass on what I have learned.')).toBeNull();
  });

  it('handles punctuation, uppercase and extra whitespace gracefully', () => {
    expect(parseVoiceCommand('   PASS   ')?.type).toBe('pass');
    expect(parseVoiceCommand('“Stop!”')?.type).toBe('stop');
    expect(parseVoiceCommand('  mark   private.  ')?.type).toBe('private');
    expect(parseVoiceCommand('Quiet mode...')?.type).toBe('serious');
  });
});
