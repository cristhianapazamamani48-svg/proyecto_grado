import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Proyecto UUB',
  description: 'Tratamiento de datos personales, derechos ARCO/GDPR, uso de IA y seguridad de la información en Proyecto UUB.',
};

export default function PrivacidadPage() {
  const fechaActualizacion = '16 de octubre de 2026';

  return (
    <article className="prose prose-slate max-w-none">
      <header className="border-b border-slate-200 pb-6 mb-8">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Protección de Datos Personales</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2 mb-2">Política de Privacidad</h1>
        <p className="text-xs text-slate-500">Última actualización: {fechaActualizacion}</p>
      </header>

      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">1. Compromiso de Privacidad</h2>
          <p>
            En <strong>Proyecto UUB</strong> respetamos la privacidad de nuestros usuarios y nos comprometemos a proteger los datos personales de estudiantes, docentes y administradores educativos con arreglo a los estándares internacionales de protección de datos (incluyendo principios GDPR y normativas latinoamericanas aplicables).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">2. Datos que Recopilamos</h2>
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">a) Docentes y Administradores:</h3>
              <p className="text-slate-600">
                Nombre completo, dirección de correo electrónico institucional o personal, contraseñas cifradas mediante algoritmos de derivación segura (bcrypt), rol institucional y registros de auditoría de creación y corrección de evaluaciones.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">b) Estudiantes / Participantes de Exámenes:</h3>
              <p className="text-slate-600">
                Nombre completo o identificador provisto al ingresar a la sesión, código de examen, respuestas enviadas, tiempos de inicio y entrega, puntajes calculados y tokens temporales de reanudación generados criptográficamente para salvaguardar su examen frente a cortes de red.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">c) Datos Técnicos y de Navegación:</h3>
              <p className="text-slate-600">
                Dirección IP (utilizada con fines de rate limiting preventivo contra abusos y ataques de fuerza bruta), tipo de navegador y registros de conexión a través de WebSockets para la sincronización de estados en vivo.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">3. Finalidad del Tratamiento de Datos</h2>
          <p>Los datos recopilados se tratan exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 mt-2">
            <li>Administrar y ejecutar las sesiones de evaluación académica solicitadas por el docente o institución.</li>
            <li>Calificar automáticamente respuestas y generar reportes analíticos de rendimiento académico.</li>
            <li>Permitir al estudiante reanudar su examen en caso de desconexión accidental.</li>
            <li>Garantizar la seguridad, integridad y trazabilidad de las calificaciones (mediante tablas de auditoría de corrección docente).</li>
            <li>Gestionar las suscripciones al plan Maestro Pro a través de pasarelas de pago seguras.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">4. Tratamiento de Datos mediante Inteligencia Artificial</h2>
          <p>
            Para la corrección de respuestas de desarrollo abierto, Proyecto UUB emplea modelos de Inteligencia Artificial. Los datos de las respuestas académicas se transmiten cifrados a través de canales seguros (TLS 1.3) y <strong>no se utilizan para entrenar modelos públicos de terceros</strong> sin el consentimiento explícito de la institución educativa.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">5. Conservación de los Datos</h2>
          <p>
            Los datos de sesiones de evaluación y respuestas de estudiantes se conservarán durante el período establecido por la institución educativa responsable o mientras la cuenta del docente se encuentre activa. El docente o administrador puede eliminar evaluaciones o solicitar el borrado de sesiones completadas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">6. Derechos del Usuario (ARCO / Acceso, Rectificación, Supresión)</h2>
          <p>
            Usted tiene derecho a acceder a sus datos personales, solicitar su rectificación cuando sean inexactos, exigir su supresión cuando ya no sean necesarios para los fines que fueron recabados, oponerse al tratamiento y solicitar la limitación del mismo. Para ejercer estos derechos, puede escribir a: <span className="font-medium text-slate-900">privacidad@proyectouub.com</span> indicando su solicitud.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">7. Seguridad de la Información</h2>
          <p>
            Implementamos rigurosas medidas técnicas y organizativas de seguridad, tales como:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 mt-2">
            <li>Cifrado en tránsito (HTTPS / WSS con TLS).</li>
            <li>Secretos criptográficos de alta entropía (≥32 caracteres) validados en el arranque del sistema.</li>
            <li>Tokens de autenticación JWT con expiración estricta y aislamiento de roles (control IDOR).</li>
            <li>Políticas de limitación de tasa (rate limiting) para protección contra ataques automatizados.</li>
            <li>Bases de datos aisladas con integridad referencial y transacciones atómicas.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">8. Contacto del Delegado de Privacidad</h2>
          <p>
            Para cualquier consulta sobre nuestra Política de Privacidad o el tratamiento de sus datos, puede contactarnos en <span className="font-medium text-slate-900">privacidad@proyectouub.com</span>. Consulte también nuestra <Link href="/legal/cookies" className="text-blue-600 underline">Política de Cookies</Link>.
          </p>
        </section>
      </div>
    </article>
  );
}
