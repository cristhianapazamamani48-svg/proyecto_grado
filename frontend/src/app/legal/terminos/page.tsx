import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos y Condiciones de Servicio | Proyecto UUB',
  description: 'Condiciones de uso de la plataforma SaaS Proyecto UUB, planes de suscripción, acuerdos de servicio y responsabilidades.',
};

export default function TerminosPage() {
  const fechaActualizacion = '16 de octubre de 2026';

  return (
    <article className="prose prose-slate max-w-none">
      <header className="border-b border-slate-200 pb-6 mb-8">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Condiciones Contractuales</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2 mb-2">Términos y Condiciones de Servicio</h1>
        <p className="text-xs text-slate-500">Última actualización: {fechaActualizacion}</p>
      </header>

      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">1. Aceptación de los Términos</h2>
          <p>
            Al crear una cuenta, suscribirse a un plan, o utilizar las funciones de <strong>Proyecto UUB</strong>, usted manifiesta su conformidad con los presentes Términos de Servicio, nuestro <Link href="/legal/aviso-legal" className="text-blue-600 underline">Aviso Legal</Link> y nuestra <Link href="/legal/privacidad" className="text-blue-600 underline">Política de Privacidad</Link>. Si no está de acuerdo, debe abstenerse de usar la plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">2. Descripción del Servicio y Modalidades de Cuenta</h2>
          <p>
            Proyecto UUB es una plataforma SaaS que permite a docentes e instituciones educativas estructurar evaluaciones académicas, gestionar sesiones en tiempo real mediante WebSockets, procesar respuestas y emitir informes automatizados con asistencia de IA.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 mt-2">
            <li><strong>Plan Base / Gratuito:</strong> Permite la creación y ejecución de evaluaciones con límites estándar definidos en la consola docente.</li>
            <li><strong>Plan Maestro Pro:</strong> Suscripción recurrente con cobro mensual (Bs 50 / $7.25 USD según pasarela), que habilita capacidades extendidas de IA, analíticas avanzadas, mayor concurrencia y soporte prioritario.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">3. Suscripciones, Facturación y Renovaciones</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong>Cobro Recurrente:</strong> Las suscripciones a Maestro Pro se renuevan automáticamente cada mes a través del procesador de pago elegido (Mercado Pago o PayPal) hasta que el usuario decida cancelar.
            </li>
            <li>
              <strong>Período de Gracia:</strong> Ante un cobro fallido, el sistema otorga un período de gracia de 7 días continuos para regularizar el método de pago sin interrumpir inmediatamente las evaluaciones activas.
            </li>
            <li>
              <strong>Cancelación:</strong> El usuario puede cancelar la suscripción en cualquier momento desde su panel de organización o directamente desde su cuenta de Mercado Pago o PayPal. La cancelación detendrá los cargos futuros y mantendrá el acceso Pro hasta el fin del período facturado.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">4. Integridad Académica y Calificaciones Asistidas por IA</h2>
          <p>
            Proyecto UUB suministra sugerencias de calificación mediante modelos de Inteligencia Artificial para optimizar el tiempo docente. <strong>El docente o la institución es el único y exclusivo responsable de validar, revisar y aprobar las notas finales de sus estudiantes</strong>. Proyecto UUB no sustituye el juicio pedagógico del evaluador.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">5. Disponibilidad y Nivel de Servicio (SLA)</h2>
          <p>
            Nos esforzamos por mantener una alta disponibilidad del sistema (objetivo del 99.5%). No obstante, el servicio puede experimentar interrupciones programadas para mantenimiento o contingencias imprevistas derivadas de proveedores de red, servidores en la nube o fallas de conectividad local del usuario.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">6. Limitación de Responsabilidad</h2>
          <p>
            En la máxima medida permitida por la ley, Proyecto UUB no será responsable de daños indirectos, pérdida de datos o lucro cesante derivados del uso o imposibilidad de uso de la plataforma. La responsabilidad total acumulada frente al usuario por cualquier reclamo se limitará al importe efectivamente abonado por el usuario en los últimos doce (12) meses de servicio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">7. Jurisdicción y Ley Aplicable</h2>
          <p>
            Estos términos se regirán e interpretarán de conformidad con las leyes vigentes aplicables al comercio electrónico y servicios de software. Para la resolución de cualquier controversia, las partes se someterán a los tribunales competentes acordados contractualmente.
          </p>
        </section>
      </div>
    </article>
  );
}
