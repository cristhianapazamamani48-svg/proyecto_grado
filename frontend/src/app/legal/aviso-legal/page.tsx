import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Aviso Legal | Proyecto UUB',
  description: 'Información legal, titularidad y condiciones generales de uso del servicio Proyecto UUB.',
};

export default function AvisoLegalPage() {
  const fechaActualizacion = '16 de octubre de 2026';

  return (
    <article className="prose prose-slate max-w-none">
      <header className="border-b border-slate-200 pb-6 mb-8">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Cumplimiento Normativo</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2 mb-2">Aviso Legal</h1>
        <p className="text-xs text-slate-500">Última actualización: {fechaActualizacion}</p>
      </header>

      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">1. Identificación del Titular del Servicio</h2>
          <p>
            En cumplimiento del principio de transparencia y la normativa aplicable a servicios de la sociedad de la información y comercio electrónico, se informa que la plataforma <strong>Proyecto UUB (Evaluaciones Académicas)</strong> es desarrollada y operada como un software bajo modalidad SaaS (Software as a Service) para la gestión, aplicación y calificación de evaluaciones académicas con asistencia de Inteligencia Artificial.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 mt-2">
            <li><strong>Denominación del Servicio:</strong> Proyecto UUB — Evaluaciones Académicas.</li>
            <li><strong>Finalidad de la plataforma:</strong> Gestión de exámenes en vivo, generación asistida por IA, calificación automatizada y analítica de desempeño para docentes e instituciones.</li>
            <li><strong>Contacto legal y de soporte:</strong> legal@proyectouub.com / soporte@proyectouub.com</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">2. Objeto y Ámbito de Aplicación</h2>
          <p>
            El presente Aviso Legal regula el acceso, navegación y uso del portal web y la API de Proyecto UUB. El acceso al sitio web o la utilización de sus funcionalidades (incluyendo el ingreso a evaluaciones como participante invitado o el acceso a la consola docente y administrativa) confiere la condición de <strong>Usuario</strong> e implica la aceptación plena y sin reservas de las disposiciones incluidas en este aviso y en los <Link href="/legal/terminos" className="text-blue-600 underline">Términos de Servicio</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">3. Propiedad Intelectual e Industrial</h2>
          <p>
            Todos los elementos que forman parte de la plataforma (incluyendo código fuente, algoritmos, interfaces gráficas, logotipos, marcas, bases de datos, documentación y arquitectura técnica) son titularidad de Proyecto UUB o se utilizan bajo licencias autorizadas y se encuentran protegidos por las leyes de propiedad intelectual e industrial.
          </p>
          <p className="mt-2">
            El contenido de las evaluaciones, preguntas y materiales subidos o generados por los docentes u organizaciones educativas pertenece a sus respectivos creadores o instituciones, quienes otorgan a Proyecto UUB una licencia técnica limitada para alojar, procesar y calificar dicho contenido exclusivamente para la prestación del servicio contratado.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">4. Condiciones de Uso y Responsabilidad</h2>
          <p>
            El Usuario se compromete a hacer un uso diligente y legal de la plataforma. Queda expresamente prohibido:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 mt-2">
            <li>Utilizar el servicio para fines fraudulentos o de suplantación de identidad en evaluaciones académicas.</li>
            <li>Intentar vulnerar los mecanismos de seguridad, rate limiting, tokens de sesión o el aislamiento entre organizaciones (multi-tenant).</li>
            <li>Introducir virus, scripts maliciosos o realizar ataques de denegación de servicio (DoS/DDoS) contra los endpoints o WebSocket de la plataforma.</li>
            <li>Realizar ingeniería inversa o extracción no autorizada de modelos de IA o prompts del sistema.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">5. Uso de Inteligencia Artificial</h2>
          <p>
            Proyecto UUB integra modelos de Inteligencia Artificial para la corrección pedagógica asistida y la sugerencia de retroalimentación. La plataforma provee herramientas de auditoría y corrección manual para que los docentes mantengan siempre el control final y la supervisión humana de las calificaciones asignadas a los estudiantes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">6. Pasarelas de Pago</h2>
          <p>
            Las transacciones correspondientes a suscripciones del plan Maestro Pro se procesan a través de proveedores certificados externos (Mercado Pago, PayPal). Proyecto UUB no almacena números completos de tarjetas de crédito o débito en sus bases de datos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">7. Modificaciones</h2>
          <p>
            Proyecto UUB se reserva el derecho de modificar o actualizar en cualquier momento y sin previo aviso la presentación, configuración o contenidos del servicio, así como las presentes condiciones legales.
          </p>
        </section>
      </div>
    </article>
  );
}
