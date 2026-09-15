import React, { useEffect, useRef } from 'react';
import type { InteractableTarget } from './playerController';

export interface TouchControlsProps {
  onMoveChange: (vector: { x: number; y: number }) => void;
  onInteract: () => void;
  nearbyTarget: InteractableTarget | null;
  disabled?: boolean;
}

export function TouchControls({
  onMoveChange,
  onInteract,
  nearbyTarget,
  disabled = false
}: TouchControlsProps) {
  const activeDirections = useRef<{
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  }>({
    up: false,
    down: false,
    left: false,
    right: false
  });

  const emitVector = () => {
    if (disabled) {
      onMoveChange({ x: 0, y: 0 });
      return;
    }
    const { up, down, left, right } = activeDirections.current;
    let x = 0;
    let y = 0;
    if (left) x -= 1;
    if (right) x += 1;
    if (up) y -= 1;
    if (down) y += 1;

    // Normalize diagonal
    if (x !== 0 && y !== 0) {
      const invSqrt2 = 0.70710678;
      x *= invSqrt2;
      y *= invSqrt2;
    }

    onMoveChange({ x, y });
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      // Don't capture when typing in textareas or inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      let changed = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        activeDirections.current.up = true;
        changed = true;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        activeDirections.current.down = true;
        changed = true;
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        activeDirections.current.left = true;
        changed = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        activeDirections.current.right = true;
        changed = true;
      } else if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
        e.preventDefault();
        onInteract();
      }

      if (changed) {
        e.preventDefault();
        emitVector();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      let changed = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        activeDirections.current.up = false;
        changed = true;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        activeDirections.current.down = false;
        changed = true;
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        activeDirections.current.left = false;
        changed = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        activeDirections.current.right = false;
        changed = true;
      }

      if (changed) {
        emitVector();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [disabled, onInteract]);

  const handleStartMove = (dir: 'up' | 'down' | 'left' | 'right') => {
    activeDirections.current[dir] = true;
    emitVector();
  };

  const handleStopMove = (dir: 'up' | 'down' | 'left' | 'right') => {
    activeDirections.current[dir] = false;
    emitVector();
  };

  const handlePointerDown = (dir: 'up' | 'down' | 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is not supported or not active
    }
    handleStartMove(dir);
  };

  const handlePointerUp = (dir: 'up' | 'down' | 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was lost
    }
    handleStopMove(dir);
  };

  const handleTouchStart = (dir: 'up' | 'down' | 'left' | 'right', e: React.TouchEvent) => {
    e.preventDefault();
    handleStartMove(dir);
  };

  const handleTouchEnd = (dir: 'up' | 'down' | 'left' | 'right', e: React.TouchEvent) => {
    e.preventDefault();
    handleStopMove(dir);
  };

  return (
    <div className="overworld-touch-controls" data-testid="touch-controls" aria-label="Game controls">
      {/* On-screen D-Pad */}
      <div className="dpad-cluster" role="group" aria-label="Directional D-Pad">
        <button
          type="button"
          className="dpad-btn dpad-up"
          data-testid="dpad-up"
          aria-label="Walk North"
          disabled={disabled}
          onPointerDown={(e) => handlePointerDown('up', e)}
          onPointerUp={(e) => handlePointerUp('up', e)}
          onPointerCancel={(e) => handlePointerUp('up', e)}
          onTouchStart={(e) => handleTouchStart('up', e)}
          onTouchEnd={(e) => handleTouchEnd('up', e)}
          onTouchCancel={(e) => handleTouchEnd('up', e)}
          onMouseDown={() => handleStartMove('up')}
          onMouseUp={() => handleStopMove('up')}
        >
          ▲
        </button>
        <div className="dpad-row">
          <button
            type="button"
            className="dpad-btn dpad-left"
            data-testid="dpad-left"
            aria-label="Walk West"
            disabled={disabled}
            onPointerDown={(e) => handlePointerDown('left', e)}
            onPointerUp={(e) => handlePointerUp('left', e)}
            onPointerCancel={(e) => handlePointerUp('left', e)}
            onTouchStart={(e) => handleTouchStart('left', e)}
            onTouchEnd={(e) => handleTouchEnd('left', e)}
            onTouchCancel={(e) => handleTouchEnd('left', e)}
            onMouseDown={() => handleStartMove('left')}
            onMouseUp={() => handleStopMove('left')}
          >
            ◀
          </button>
          <div className="dpad-center" aria-hidden="true" />
          <button
            type="button"
            className="dpad-btn dpad-right"
            data-testid="dpad-right"
            aria-label="Walk East"
            disabled={disabled}
            onPointerDown={(e) => handlePointerDown('right', e)}
            onPointerUp={(e) => handlePointerUp('right', e)}
            onPointerCancel={(e) => handlePointerUp('right', e)}
            onTouchStart={(e) => handleTouchStart('right', e)}
            onTouchEnd={(e) => handleTouchEnd('right', e)}
            onTouchCancel={(e) => handleTouchEnd('right', e)}
            onMouseDown={() => handleStartMove('right')}
            onMouseUp={() => handleStopMove('right')}
          >
            ▶
          </button>
        </div>
        <button
          type="button"
          className="dpad-btn dpad-down"
          data-testid="dpad-down"
          aria-label="Walk South"
          disabled={disabled}
          onPointerDown={(e) => handlePointerDown('down', e)}
          onPointerUp={(e) => handlePointerUp('down', e)}
          onPointerCancel={(e) => handlePointerUp('down', e)}
          onTouchStart={(e) => handleTouchStart('down', e)}
          onTouchEnd={(e) => handleTouchEnd('down', e)}
          onTouchCancel={(e) => handleTouchEnd('down', e)}
          onMouseDown={() => handleStartMove('down')}
          onMouseUp={() => handleStopMove('down')}
        >
          ▼
        </button>
      </div>

      {/* Action [A] Interact Button */}
      <div className="action-button-cluster" role="group" aria-label="Action controls">
        <button
          type="button"
          className={`interact-btn ${nearbyTarget ? 'has-target' : ''}`}
          data-testid="interact-action-btn"
          aria-label={
            nearbyTarget
              ? `Interact with ${nearbyTarget.label}`
              : 'Interact (Walk near a landmark to talk or explore)'
          }
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            onInteract();
          }}
        >
          <span className="btn-letter" aria-hidden="true">A</span>
          <span className="btn-label">
            {nearbyTarget
              ? nearbyTarget.type === 'door'
                ? 'Open'
                : nearbyTarget.type === 'boss'
                ? 'Challenge'
                : nearbyTarget.type === 'waystone'
                ? 'Read'
                : nearbyTarget.type === 'prop'
                ? 'Inspect'
                : nearbyTarget.type === 'exit'
                ? 'Exit'
                : 'Talk'
              : 'Interact'}
          </span>
        </button>
      </div>
    </div>
  );
}
