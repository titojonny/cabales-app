import { Button, Modal, useOverlayState } from '@heroui/react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Contenido React que se renderiza mientras ningún descendiente falla. */
interface AppErrorBoundaryProps {
  children: ReactNode;
}

/** Estado mínimo necesario para sustituir el árbol fallido por una recuperación segura. */
interface AppErrorBoundaryState {
  error: Error | null;
}

/** Evita pantallas en blanco cuando un módulo falla durante su renderizado. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error de renderizado en Cabales', {
      error,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return <CriticalErrorModal />;
  }
}

/** Modal no descartable que ofrece recarga cuando el árbol React no puede continuar. */
function CriticalErrorModal() {
  const state = useOverlayState({ isOpen: true });

  return (
    <Modal state={state}>
      <Modal.Backdrop isDismissable={false}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>No pudimos mostrar este módulo</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              Tu sesión y tus datos siguen protegidos. Puedes reintentar o volver a cargar Cabales.
            </Modal.Body>
            <Modal.Footer>
              <Button variant="primary" type="button" onPress={() => window.location.reload()}>
                Reintentar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
