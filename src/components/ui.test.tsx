import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../api/http';
import { ErrorMessage, FieldError, ProgressBar, StatusPanel, errorText, formatBytes } from './ui';

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

describe('mensajes de error', () => {
  it('muestra errores de campo visibles y asociables', () => {
    render(<FieldError id="campo-error" message="Obligatorio." />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeVisible();
    expect(alert).toHaveAttribute('id', 'campo-error');
  });

  it('no renderiza nada sin mensaje', () => {
    const { container } = render(<FieldError id="vacio" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('traduce límites de uso y muestra el error en línea', () => {
    const error = new HttpError('Too many', 429, 'RATE_LIMITED');
    expect(errorText(error)).toMatch(/intentos/i);
    render(<ErrorMessage error={new Error('Falló la red')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falló la red');
  });

  it('acota el progreso y formatea tamaños', () => {
    render(<ProgressBar value={140} label="Presupuesto" />);
    expect(screen.getByRole('progressbar', { name: 'Presupuesto' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
});
