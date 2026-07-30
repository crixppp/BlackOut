import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';

describe('App', () => {
  it('shows home actions without a continue button when there is no save', () => {
    localStorage.clear();
    render(<App />);

    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue game/i })).not.toBeInTheDocument();
  });

  it('shows setup validation and starts after acknowledgement', () => {
    localStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(screen.getByRole('button', { name: /start game/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/legal drinking age/i));
    expect(screen.getByRole('button', { name: /start game/i })).not.toBeDisabled();
  });

  it('shows difficulty setup and omits host controls', () => {
    localStorage.clear();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /new game/i }));

    expect(screen.getByRole('button', { name: /black out/i })).toBeInTheDocument();
    expect(screen.queryByText(/host controls/i)).not.toBeInTheDocument();
  });

  it('starts on a visible board with compact roll controls', () => {
    localStorage.clear();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    fireEvent.click(screen.getByLabelText(/legal drinking age/i));
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));

    expect(document.querySelector('.board-path')).toBeInTheDocument();
    expect(document.querySelector('.game-control-dock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /roll dice/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /turn/i })).not.toBeInTheDocument();
  });

  it('toggles the alcohol-free quick setting', () => {
    localStorage.clear();
    render(<App />);

    const toggle = screen.getByLabelText(/alcohol-free/i);
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });
});
