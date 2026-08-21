import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPanel } from './ui';

describe('StatusPanel', () => {
  it('expone el estado y su acción con semántica accesible', () => {
    render(
      <StatusPanel title="Sin grupos" action={<button type="button">Crear</button>}>
        <p>Crea el primero.</p>
      </StatusPanel>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Sin grupos');
    expect(screen.getByRole('button', { name: 'Crear' })).toHaveAccessibleName();
  });
});
