import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Cookies y Almacenamiento Local | Proyecto UUB',
  description: 'Detalle sobre el uso de cookies técnicas, almacenamiento local (localStorage) y preferencias en Proyecto UUB.',
};

export default function CookiesPage() {
  const fechaActualizacion = '16 de octubre de 2026';

  return (
    <article className="prose prose-slate max-w-none">
      <header className="border-b border-slate-200 pb-6 mb-8">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Transparencia Digital</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2 mb-2">Política de Cookies y Almacenamiento Local</h1>
        <p className="text-xs text-slate-500">Última actualización: {fechaActualizacion}</p>
      </header>

      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">1. ¿Qué son las Cookies y el Almacenamiento Local?</h2>
          <p>
            Las <strong>cookies</strong> son pequeños archivos de texto que los sitios web descargan en su dispositivo al navegar. El <strong>almacenamiento local (localStorage)</strong> es una tecnología estándar de los navegadores web que permite almacenar datos de manera segura y persistente en el dispositivo del usuario sin transmitir automáticamente información en cada petición HTTP.
          </p>
          <p className="mt-2">
            Proyecto UUB prioriza el uso de <strong>tecnologías estrictamente necesarias</strong> para que las evaluaciones no se interrumpan, reduciendo al mínimo el almacenamiento innecesario o invasivo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">2. Tecnologías y Finalidades Empleadas</h2>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800">
                  <th className="p-3 border border-slate-200 font-bold">Identificador / Clave</th>
                  <th className="p-3 border border-slate-200 font-bold">Tipo</th>
                  <th className="p-3 border border-slate-200 font-bold">Finalidad y Necesidad</th>
                  <th className="p-3 border border-slate-200 font-bold">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600">
                <tr>
                  <td className="p-3 border border-slate-200 font-mono font-bold text-slate-800">uub_docente_token</td>
                  <td className="p-3 border border-slate-200">localStorage (Técnica)</td>
                  <td className="p-3 border border-slate-200">Almacena el JWT del docente para autenticar peticiones y la conexión WebSocket en vivo.</td>
                  <td className="p-3 border border-slate-200">Hasta cierre de sesión (máx. 7 días)</td>
                </tr>
                <tr>
                  <td className="p-3 border border-slate-200 font-mono font-bold text-slate-800">uub_guest_token</td>
                  <td className="p-3 border border-slate-200">localStorage (Esencial)</td>
                  <td className="p-3 border border-slate-200">Token temporal para que el estudiante rinda el examen asignado.</td>
                  <td className="p-3 border border-slate-200">Hasta entrega del examen</td>
                </tr>
                <tr>
                  <td className="p-3 border border-slate-200 font-mono font-bold text-slate-800">uub_token_reanudacion</td>
                  <td className="p-3 border border-slate-200">localStorage (Esencial)</td>
                  <td className="p-3 border border-slate-200">Clave criptográfica para reanudar el examen si se desconecta o recarga la página.</td>
                  <td className="p-3 border border-slate-200">Hasta finalización de la sesión</td>
                </tr>
                <tr>
                  <td className="p-3 border border-slate-200 font-mono font-bold text-slate-800">uub_cookie_consent_v1</td>
                  <td className="p-3 border border-slate-200">localStorage (Preferencia)</td>
                  <td className="p-3 border border-slate-200">Guarda la preferencia del usuario sobre el aviso de cookies y privacidad.</td>
                  <td className="p-3 border border-slate-200">Persistente (1 año)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">3. Ausencia de Cookies de Rastreo Publicitario de Terceros</h2>
          <p>
            Proyecto UUB es una plataforma académica y profesional. <strong>No vendemos datos de navegación a redes publicitarias ni incorporamos cookies de rastreo comercial invasivo de terceros (como píxeles de retargeting de redes sociales)</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">4. Gestión y Desactivación de Cookies</h2>
          <p>
            Usted puede configurar o bloquear cookies y almacenamiento local mediante los controles de su navegador (Chrome, Firefox, Safari, Edge):
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 mt-2">
            <li><strong>Google Chrome:</strong> Configuración → Privacidad y seguridad → Cookies y otros datos de sitios.</li>
            <li><strong>Mozilla Firefox:</strong> Opciones → Privacidad & Seguridad → Cookies y datos del sitio.</li>
            <li><strong>Microsoft Edge:</strong> Configuración → Permisos del sitio → Cookies y datos del sitio.</li>
            <li><strong>Apple Safari:</strong> Preferencias → Privacidad → Bloquear todas las cookies.</li>
          </ul>
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs mt-3">
            <strong>Aviso importante:</strong> Si bloquea el almacenamiento local técnico, no podrá autenticarse como docente ni guardar respuestas durante los exámenes en vivo.
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">5. Más Información</h2>
          <p>
            Para más detalles sobre la protección de su información personal, consulte nuestra <Link href="/legal/privacidad" className="text-blue-600 underline">Política de Privacidad</Link>.
          </p>
        </section>
      </div>
    </article>
  );
}
