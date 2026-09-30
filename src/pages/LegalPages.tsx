import { Link } from 'react-router-dom';

/** Aviso base que debe completarse con la identidad y contacto jurídicos antes de producción. */
export function PrivacyPage() {
  return (
    <main className="legal-page">
      <header className="public-header">
        <Link to="/" className="brand">
          <span className="brand-glyph" aria-hidden="true">
            C
          </span>
          <span>Cabales</span>
        </Link>
        <Link className="button quiet" to="/register">
          Crear cuenta
        </Link>
      </header>
      <article className="legal-content">
        <p className="eyebrow">Privacidad</p>
        <h1>Aviso de privacidad</h1>
        <p className="lead">
          Este aviso explica qué datos trata Cabales para organizar grupos, gastos y liquidaciones.
        </p>
        <h2>Datos que tratamos</h2>
        <p>
          Identidad y contacto de la cuenta, datos de grupos e invitaciones, participantes, gastos,
          liquidaciones, sesiones técnicas y registros de seguridad.
        </p>
        <h2>Finalidades</h2>
        <p>
          Crear y proteger cuentas, permitir la colaboración dentro de grupos, calcular repartos,
          registrar liquidaciones, prevenir abuso y mantener la seguridad y disponibilidad del
          servicio.
        </p>
        <h2>Minimización y conservación</h2>
        <p>
          Cabales debe conservar cada categoría solo durante el plazo necesario para su finalidad,
          obligaciones legales y resolución de disputas. Las sesiones, IP, invitaciones y registros
          técnicos deben eliminarse o anonimizarse mediante una política de retención.
        </p>
        <h2>Derechos</h2>
        <p>
          La persona titular puede solicitar acceso, rectificación, cancelación, oposición,
          portabilidad, olvido y limitación del tratamiento. La aplicación debe habilitar un canal
          verificable y gratuito para estas solicitudes.
        </p>
        <h2>Encargados y transferencias</h2>
        <p>
          Los proveedores de alojamiento, correo, almacenamiento, OCR, analítica y soporte deberán
          estar identificados y sujetos a acuerdos de tratamiento y confidencialidad.
        </p>
        <h2>Contacto y responsable</h2>
        <p className="legal-warning">
          Pendiente de completar antes de producción: razón social o responsable, domicilio,
          delegado de protección de datos y canal oficial para solicitudes.
        </p>
        <p className="muted">Última revisión: septiembre de 2026.</p>
      </article>
    </main>
  );
}

/** Presenta los términos base del servicio y señala la revisión jurídica pendiente. */
export function TermsPage() {
  return (
    <main className="legal-page">
      <header className="public-header">
        <Link to="/" className="brand">
          <span className="brand-glyph" aria-hidden="true">
            C
          </span>
          <span>Cabales</span>
        </Link>
      </header>
      <article className="legal-content">
        <p className="eyebrow">Servicio</p>
        <h1>Términos de uso</h1>
        <p className="lead">
          Cabales ayuda a coordinar gastos entre personas; no procesa pagos ni garantiza que una
          deuda sea cobrada.
        </p>
        <h2>Responsabilidad de la información</h2>
        <p>
          Las personas usuarias deben registrar datos exactos, proteger sus credenciales y revisar
          los gastos y liquidaciones antes de confirmar acuerdos.
        </p>
        <h2>Uso aceptable</h2>
        <p>
          No se permite usar Cabales para fraude, acoso, acceso no autorizado, distribución de
          malware o tratamiento ilícito de datos de terceros.
        </p>
        <h2>Disponibilidad</h2>
        <p>
          El servicio puede cambiar, suspenderse o limitarse por mantenimiento, seguridad o
          capacidad. Las operaciones financieras deben poder revisarse mediante su historial.
        </p>
        <p className="muted">
          Documento base pendiente de revisión jurídica y publicación de la identidad del
          responsable.
        </p>
      </article>
    </main>
  );
}
