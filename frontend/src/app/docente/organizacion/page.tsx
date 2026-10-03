'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('uub_docente_token') : null;
}

export default function DocenteOrganizacionPage() {
  const router = useRouter();
  const [org, setOrg] = useState<any>(null);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [invitaciones, setInvitaciones] = useState<any[]>([]);
  const [usoIa, setUsoIa] = useState<any>(null);
  const [suscripcion, setSuscripcion] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoCheckout, setCargandoCheckout] = useState(false);
  const [aprobandoPagoSandbox, setAprobandoPagoSandbox] = useState(false);
  const [pagoSandboxPendiente, setPagoSandboxPendiente] = useState<{ idTransaccion: number; montoLocal: number; monedaLocal: string } | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<'resumen' | 'miembros' | 'invitaciones' | 'codigo' | 'ia' | 'suscripcion'>('resumen');

  // Formularios
  const [correoInvitar, setCorreoInvitar] = useState('');
  const [rolInvitar, setRolInvitar] = useState('DOCENTE');
  const [invitacionCreada, setInvitacionCreada] = useState<any>(null);

  // Código de acceso config
  const [codigoActivo, setCodigoActivo] = useState(false);
  const [aprobacionRequerida, setAprobacionRequerida] = useState(true);

  // Feedback
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  };

  const cargarDatos = async () => {
    const token = getToken();
    if (!token) {
      router.push('/docente/login');
      return;
    }
    setCargando(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [resOrg, resMiembros, resInv, resIa, resSub] = await Promise.all([
        fetch(`${API}/organizaciones/mi-organizacion`, { headers }),
        fetch(`${API}/organizaciones/mi-organizacion/miembros`, { headers }),
        fetch(`${API}/organizaciones/mi-organizacion/invitaciones`, { headers }),
        fetch(`${API}/organizaciones/mi-organizacion/uso-ia`, { headers }),
        fetch(`${API}/pagos/mi-suscripcion`, { headers }),
      ]);

      if (resOrg.ok) {
        const dataOrg = await resOrg.json();
        setOrg(dataOrg);
        setCodigoActivo(dataOrg.codigoAccesoActivo ?? false);
        setAprobacionRequerida(dataOrg.aprobacionRequerida ?? true);
      }
      if (resMiembros.ok) setMiembros(await resMiembros.json());
      if (resInv.ok) setInvitaciones(await resInv.json());
      if (resIa.ok) setUsoIa(await resIa.json());
      if (resSub.ok) setSuscripcion(await resSub.json());
    } catch (err) {
      mostrarMensaje('error', 'Error al cargar información de la organización.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // CAPTURA DE RETORNO DE PAYPAL
  // ───────────────────────────────────────────────────────────────────────────
  const capturaEnProgreso = useRef(false);
  const [errorCapturaPayPal, setErrorCapturaPayPal] = useState<string | null>(null);

  const intentarCapturaPayPal = useCallback(async (paypalToken: string) => {
    mostrarMensaje('ok', 'Procesando pago de PayPal, por favor espera...');
    setCargandoCheckout(true);
    setErrorCapturaPayPal(null);
    try {
      const auth = getToken();
      const res = await fetch(`${API}/pagos/paypal/${paypalToken}/capturar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth}` },
      });
      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('ok', data.mensaje || '¡Pago de PayPal capturado con éxito!');
        await cargarDatos();
        // Limpiar URL SÓLO si hubo éxito para no perder el token si hay fallo de red o API
        router.replace(window.location.pathname, { scroll: false });
      } else {
        mostrarMensaje('error', data.message || 'Error al capturar el pago.');
        setErrorCapturaPayPal(paypalToken);
        capturaEnProgreso.current = false; // Permitir reintento
      }
    } catch (err: any) {
      mostrarMensaje('error', 'Error de conexión al capturar el pago.');
      setErrorCapturaPayPal(paypalToken);
      capturaEnProgreso.current = false;
    } finally {
      setCargandoCheckout(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const paypalToken = urlParams.get('token');
    const esExito = urlParams.get('pago') === 'exito';

    if (paypalToken && esExito && !capturaEnProgreso.current) {
      capturaEnProgreso.current = true;
      if (tab !== 'suscripcion') {
        setTab('suscripcion');
      }
      intentarCapturaPayPal(paypalToken);
    }
  }, [router, tab, intentarCapturaPayPal]);

  // ───────────────────────────────────────────────────────────────────────────

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correoInvitar.trim()) return;

    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/invitar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ correo: correoInvitar, rol: rolInvitar }),
      });
      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('ok', `Invitación creada exitosamente para ${correoInvitar}`);
        setInvitacionCreada(data);
        setCorreoInvitar('');
        cargarDatos();
      } else {
        mostrarMensaje('error', data.message || 'Error al enviar invitación.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleRevocarInvitacion = async (id: number) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/invitaciones/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Invitación revocada.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'No se pudo revocar la invitación.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleAprobarMembresia = async (idMembresia: number) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/miembros/${idMembresia}/aprobar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Membresía aprobada.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'Error al aprobar membresía.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleRechazarMembresia = async (idMembresia: number) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/miembros/${idMembresia}/rechazar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Membresía rechazada.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'Error al rechazar membresía.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleGenerarCodigo = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/codigo-acceso`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Nuevo código generado.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'Error al generar código.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleGuardarConfigCodigo = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/organizaciones/mi-organizacion/codigo-acceso`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activo: codigoActivo,
          aprobacionRequerida,
        }),
      });
      if (res.ok) {
        mostrarMensaje('ok', 'Configuración de código actualizada.');
        cargarDatos();
      } else {
        mostrarMensaje('error', 'Error al actualizar configuración.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    }
  };

  const handleCrearCheckout = async (proveedor: 'MOCK_SANDBOX' | 'MERCADOPAGO' | 'PAYPAL') => {
    const token = getToken();
    setCargandoCheckout(true);
    setCheckoutUrl(null);
    try {
      const res = await fetch(`${API}/pagos/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: 'MAESTRO_PRO', proveedor }),
      });
      const data = await res.json();
      if (res.ok) {
        if (proveedor === 'MOCK_SANDBOX' && data.idTransaccion) {
          setPagoSandboxPendiente({
            idTransaccion: data.idTransaccion,
            montoLocal: data.montoLocal,
            monedaLocal: data.monedaLocal,
          });
          mostrarMensaje('ok', 'Pago de prueba creado. Confirma la simulación para activar Maestro Pro.');
          await cargarDatos();
          return;
        }
        if (data.urlCheckout) {
          setCheckoutUrl(data.urlCheckout);
          mostrarMensaje('ok', 'Sesión de pago creada. Redirige al proveedor de pago.');
        } else if (data.estado === 'APROBADO') {
          mostrarMensaje('ok', '¡Pago de prueba aprobado! Tu plan ha sido actualizado.');
          cargarDatos();
        } else {
          mostrarMensaje('ok', `Sesión creada (${data.estado}). ID: ${data.idTransaccion || ''}`);
          cargarDatos();
        }
      } else {
        mostrarMensaje('error', data.message || 'Error al crear sesión de pago.');
      }
    } catch (err: any) {
      mostrarMensaje('error', 'Error de conexión al iniciar pago.');
    } finally {
      setCargandoCheckout(false);
    }
  };

  const handleAprobarPagoSandbox = async () => {
    if (!pagoSandboxPendiente) return;
    const token = getToken();
    setAprobandoPagoSandbox(true);
    try {
      const res = await fetch(`${API}/pagos/sandbox/${pagoSandboxPendiente.idTransaccion}/aprobar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo aprobar el pago de prueba.');
      setPagoSandboxPendiente(null);
      mostrarMensaje('ok', 'Pago de prueba aprobado. Maestro Pro ya está activo.');
      await cargarDatos();
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al aprobar el pago de prueba.');
    } finally {
      setAprobandoPagoSandbox(false);
    }
  };

  const [cargandoCancelacion, setCargandoCancelacion] = useState(false);

  const handleCancelarSuscripcion = async () => {
    if (!confirm('¿Estás seguro de que deseas cancelar la renovación automática? Mantendrás el acceso hasta el fin del período actual.')) return;
    const token = getToken();
    setCargandoCancelacion(true);
    try {
      const res = await fetch(`${API}/pagos/cancelar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('ok', data.mensaje || 'Renovación automática cancelada.');
        cargarDatos();
      } else {
        mostrarMensaje('error', data.message || 'Error al cancelar suscripción.');
      }
    } catch (err) {
      mostrarMensaje('error', 'Error de conexión.');
    } finally {
      setCargandoCancelacion(false);
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/docente/dashboard" className="text-slate-400 hover:text-slate-600 font-medium text-sm">
              ← Dashboard
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              🏢 {org?.nombre || 'Mi Organización'}
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 uppercase">
                Plan {org?.plan || 'GRATUITO'}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docente/dashboard"
              className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium rounded-lg transition"
            >
              Volver al Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Alerta de notificación */}
      {mensaje && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div
            className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
              mensaje.tipo === 'ok'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <span>{mensaje.texto}</span>
            <button onClick={() => setMensaje(null)} className="text-xs font-bold uppercase tracking-wider opacity-60 hover:opacity-100">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Sub-Navegación por Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {[
            { id: 'resumen', label: '📊 Resumen & Límites' },
            { id: 'suscripcion', label: '💳 Suscripción y Pagos' },
            { id: 'miembros', label: `👥 Miembros (${miembros.length})` },
            { id: 'invitaciones', label: `✉️ Invitaciones (${invitaciones.filter(i => i.estado === 'PENDIENTE').length})` },
            { id: 'codigo', label: '🔑 Código de Organización' },
            { id: 'ia', label: '🤖 Consumo de IA' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as any)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                tab === item.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* TAB: SUSCRIPCIÓN Y PAGOS */}
        {tab === 'suscripcion' && (
          <div className="space-y-6">
            {errorCapturaPayPal && (
               <div className="bg-red-50 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between border border-red-200">
                  <span className="text-sm text-red-800 font-medium mb-3 md:mb-0">
                    Ocurrió un error al procesar el retorno de PayPal. Tu pago podría estar aprobado.
                  </span>
                  <button 
                    onClick={() => intentarCapturaPayPal(errorCapturaPayPal)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700"
                  >
                    Reintentar Confirmación
                  </button>
               </div>
            )}
            
            {/* Estado actual del plan */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Plan Actual</p>
                  <div className="flex items-center gap-3 mt-1">
                    <h2 className="text-2xl font-extrabold text-slate-800">
                      {suscripcion?.plan === 'MAESTRO_PRO' ? 'Plan Maestro Pro' : 'Plan Gratuito'}
                    </h2>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${
                      suscripcion?.estadoSuscripcion === 'ACTIVA'
                        ? 'bg-green-100 text-green-700'
                        : suscripcion?.estadoSuscripcion === 'EN_PERIODO_GRACIA'
                        ? 'bg-amber-100 text-amber-700 animate-pulse'
                        : suscripcion?.estadoSuscripcion === 'CANCELADA'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {suscripcion?.estadoSuscripcion === 'ACTIVA' ? '✓ Activa'
                        : suscripcion?.estadoSuscripcion === 'EN_PERIODO_GRACIA' ? '⚠ Período de Gracia'
                        : suscripcion?.estadoSuscripcion === 'CANCELADA' ? 'Cancelada'
                        : suscripcion?.estadoSuscripcion || 'Gratuito'}
                    </span>
                  </div>
                  {suscripcion?.fechaFinPeriodo && (
                    <p className="text-sm text-slate-500 mt-1">
                      Acceso hasta: <strong>{new Date(suscripcion.fechaFinPeriodo).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                    </p>
                  )}
                  {suscripcion?.fechaProximoCobro && suscripcion?.autoRenovar && (
                    <p className="text-sm text-slate-500">
                      Próximo cobro: <strong>{new Date(suscripcion.fechaProximoCobro).toLocaleDateString('es-BO')}</strong>
                    </p>
                  )}
                  {suscripcion?.estadoSuscripcion === 'EN_PERIODO_GRACIA' && suscripcion?.fechaFinGracia && (
                    <p className="text-sm text-amber-600 font-semibold mt-1">
                      ⚠ Período de gracia vence el {new Date(suscripcion.fechaFinGracia).toLocaleDateString('es-BO')}. Renueva para evitar suspensión.
                    </p>
                  )}
                </div>
                {suscripcion?.plan !== 'MAESTRO_PRO' || suscripcion?.estadoSuscripcion === 'CANCELADA' || suscripcion?.estadoSuscripcion === 'EN_PERIODO_GRACIA' ? (
                  <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-5 rounded-2xl shadow-lg min-w-[220px] text-center">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-80">Plan Maestro Pro</p>
                    <p className="text-3xl font-extrabold mt-1">Bs 50<span className="text-sm font-normal opacity-80"> / mes</span></p>
                    <p className="text-xs opacity-75 mt-0.5">≈ $7.25 USD · Pago mensual</p>
                    <p className="text-xs opacity-70 mt-1">Cancela cuando quieras</p>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 p-5 rounded-2xl text-center min-w-[180px]">
                    <p className="text-xs font-semibold text-green-600 uppercase">Estado</p>
                    <p className="text-lg font-extrabold text-green-700 mt-1">✓ Activo</p>
                    <p className="text-xs text-green-600 mt-1">Acceso completo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Consumo actual */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Evaluaciones</p>
                <p className="text-2xl font-extrabold text-slate-800 mt-1">
                  {suscripcion?.limites?.evaluacionesTotal ?? 0}
                  <span className="text-base font-normal text-slate-400">
                    {' '}/ {suscripcion?.limites?.evaluacionesLimite >= 99999 ? '∞' : suscripcion?.limites?.evaluacionesLimite ?? 20}
                  </span>
                </p>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{
                      width: `${suscripcion?.limites?.evaluacionesLimite >= 99999
                        ? 0
                        : Math.min(100, ((suscripcion?.limites?.evaluacionesTotal ?? 0) / (suscripcion?.limites?.evaluacionesLimite ?? 20)) * 100)}%`
                    }}
                  />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Créditos IA (mes)</p>
                <p className="text-2xl font-extrabold text-indigo-700 mt-1">
                  {suscripcion?.limites?.iaUsadasMes ?? 0}
                  <span className="text-base font-normal text-slate-400">
                    {' '}/ {suscripcion?.limites?.iaLimiteMes >= 99999 ? '∞' : suscripcion?.limites?.iaLimiteMes ?? 10}
                  </span>
                </p>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{
                      width: `${suscripcion?.limites?.iaLimiteMes >= 99999
                        ? 0
                        : Math.min(100, ((suscripcion?.limites?.iaUsadasMes ?? 0) / (suscripcion?.limites?.iaLimiteMes ?? 10)) * 100)}%`
                    }}
                  />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Contenido Privado</p>
                <p className={`text-lg font-extrabold mt-2 ${suscripcion?.limites?.esContenidoPrivado ? 'text-green-600' : 'text-slate-400'}`}>
                  {suscripcion?.limites?.esContenidoPrivado ? '✓ Habilitado' : '✗ No disponible'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {suscripcion?.limites?.esContenidoPrivado ? 'Plan Pro activo' : 'Requiere Plan Pro'}
                </p>
              </div>
            </div>

            {/* Panel de upgrade o gestión */}
            {(suscripcion?.plan !== 'MAESTRO_PRO' || suscripcion?.estadoSuscripcion === 'CANCELADA' || suscripcion?.estadoSuscripcion === 'EN_PERIODO_GRACIA') && (
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 p-6 rounded-2xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-indigo-900">Actualizar al Plan Maestro Pro</h3>
                  <p className="text-sm text-indigo-700 mt-1">
                    Acceso ilimitado a evaluaciones, créditos de IA, contenido privado y más funciones avanzadas por un pago de <strong>Bs 50 al mes</strong>.
                  </p>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-indigo-800">
                  {[
                    'Almacenamiento ilimitado de evaluaciones',
                    'Créditos de IA ilimitados por mes',
                    'Contenido privado para tu clase',
                    'Reabrir tareas vencidas',
                    'Pausar y reanudar actividades en vivo',
                    'Calificación flexible de respuestas abiertas',
                    'Más tipos de preguntas disponibles',
                    'Soporte prioritario',
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-indigo-500 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>

                {checkoutUrl && (
                  <div className="p-4 bg-white border border-indigo-300 rounded-xl">
                    <p className="text-sm font-semibold text-indigo-800 mb-2">Enlace de pago generado:</p>
                    <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                      className="block text-xs font-mono text-indigo-600 underline break-all">
                      {checkoutUrl}
                    </a>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => handleCrearCheckout('MOCK_SANDBOX')}
                    disabled={cargandoCheckout}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow transition"
                  >
                    {cargandoCheckout ? 'Procesando...' : '🧪 Pago de Prueba (Sandbox)'}
                  </button>
                  <button
                    onClick={() => handleCrearCheckout('MERCADOPAGO')}
                    disabled={cargandoCheckout}
                    className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow transition"
                  >
                    💳 Pagar con Mercado Pago
                  </button>
                  <button
                    onClick={() => handleCrearCheckout('PAYPAL')}
                    disabled={cargandoCheckout}
                    className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-slate-900 font-semibold text-sm rounded-xl shadow transition"
                  >
                    🅿 Pagar con PayPal
                  </button>
                </div>

                {pagoSandboxPendiente && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 space-y-3">
                    <div>
                      <h4 className="font-bold text-amber-950">Simulación de pago</h4>
                      <p className="text-sm text-amber-900 mt-1">
                        Se creó un pago de prueba por {pagoSandboxPendiente.monedaLocal} {pagoSandboxPendiente.montoLocal.toFixed(2)}. No se realizará ningún cobro real.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleAprobarPagoSandbox}
                        disabled={aprobandoPagoSandbox}
                        className="px-5 py-2.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl"
                      >
                        {aprobandoPagoSandbox ? 'Confirmando...' : 'Aprobar pago de prueba'}
                      </button>
                      <button
                        onClick={() => setPagoSandboxPendiente(null)}
                        disabled={aprobandoPagoSandbox}
                        className="px-5 py-2.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 font-semibold text-sm rounded-xl"
                      >
                        Cancelar simulación
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Gestión de suscripción activa */}
            {suscripcion?.plan === 'MAESTRO_PRO' && suscripcion?.estadoSuscripcion === 'ACTIVA' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-4">Gestión del Plan</h3>
                <div className="flex flex-wrap gap-3">
                  {suscripcion?.autoRenovar ? (
                    <button
                      onClick={handleCancelarSuscripcion}
                      disabled={cargandoCancelacion}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 font-semibold text-sm rounded-lg border border-red-200 transition"
                    >
                      {cargandoCancelacion ? 'Cancelando...' : 'Cancelar Renovación Automática'}
                    </button>
                  ) : (
                    <p className="text-sm text-slate-500">La renovación automática está desactivada. Seguirás con acceso Pro hasta el fin del período.</p>
                  )}
                </div>
              </div>
            )}

            {/* Historial de transacciones */}
            {suscripcion?.historialTransacciones?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-800">Historial de Pagos</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Plan</th>
                        <th className="p-4">Monto</th>
                        <th className="p-4">Proveedor</th>
                        <th className="p-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {suscripcion.historialTransacciones.map((tx: any) => (
                        <tr key={tx.idTransaccion} className="hover:bg-slate-50 transition">
                          <td className="p-4 text-slate-600 text-xs">
                            {new Date(tx.fechaTransaccion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-4 font-semibold text-slate-800">{tx.planContratado}</td>
                          <td className="p-4 text-slate-700">
                            {tx.monedaLocal} {Number(tx.montoLocal || 0).toFixed(2)}
                            <span className="text-xs text-slate-400 ml-1">(${Number(tx.montoUsd || 0).toFixed(2)} USD)</span>
                          </td>
                          <td className="p-4 text-xs text-slate-500 uppercase">{tx.proveedor?.replace('_', ' ')}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                              tx.estado === 'APROBADO'
                                ? 'bg-green-100 text-green-700'
                                : tx.estado === 'PENDIENTE'
                                ? 'bg-amber-100 text-amber-700'
                                : tx.estado === 'RECHAZADO'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {tx.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: RESUMEN Y LÍMITES */}
        {tab === 'resumen' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Docentes Permitidos</p>
                <p className="text-3xl font-extrabold text-slate-800 mt-2">
                  {org?._count?.membresias || 0} / <span className="text-slate-400">{org?.limiteDocentes}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Límite por plan actual</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Evaluaciones Creadas</p>
                <p className="text-3xl font-extrabold text-slate-800 mt-2">
                  {org?._count?.evaluaciones || 0} / <span className="text-slate-400">{org?.limiteEvaluaciones}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">En la organización</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Correcciones IA Mes</p>
                <p className="text-3xl font-extrabold text-indigo-600 mt-2">
                  {usoIa?.usadas || 0} / <span className="text-slate-400">{usoIa?.limite || 50}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Disponibles: <strong className="text-green-600">{usoIa?.disponibles || 0}</strong>
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Estado de Cuenta</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-lg font-bold text-slate-800">Activo</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Reinicio IA: {usoIa?.reiniciaPeriodo ? new Date(usoIa.reiniciaPeriodo).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>

            {/* Barra de progreso de IA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Consumo de Créditos de IA (Mes Actual)</h3>
                  <p className="text-xs text-slate-500">Solo cuentan las evaluaciones procesadas exitosamente.</p>
                </div>
                <span className="text-sm font-bold text-indigo-600">
                  {usoIa?.porcentajeUsado || 0}% consumido
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, usoIa?.porcentajeUsado || 0)}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MIEMBROS Y APROBACIONES */}
        {tab === 'miembros' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Miembros de la Organización</h3>
                <p className="text-xs text-slate-500">Administra accesos y aprueba docentes pendientes.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Usuario</th>
                    <th className="p-4">Correo</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4">Método Ingreso</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {miembros.map((m) => (
                    <tr key={m.idMembresia} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-semibold text-slate-800">
                        {m.usuario?.nombre} {m.usuario?.apellido}
                      </td>
                      <td className="p-4 text-slate-600">{m.usuario?.correo}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                          {m.rol}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-500">{m.metodoIngreso || 'REGISTRO'}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            m.estado === 'ACTIVO'
                              ? 'bg-green-100 text-green-700'
                              : m.estado === 'PENDIENTE_APROBACION'
                              ? 'bg-amber-100 text-amber-700 animate-pulse'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {m.estado}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {m.estado === 'PENDIENTE_APROBACION' && (
                          <>
                            <button
                              onClick={() => handleAprobarMembresia(m.idMembresia)}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700 transition"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => handleRechazarMembresia(m.idMembresia)}
                              className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md hover:bg-red-200 transition"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INVITACIONES POR CORREO */}
        {tab === 'invitaciones' && (
          <div className="space-y-6">
            {/* Formulario de Nueva Invitación */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800">Enviar Invitación por Correo</h3>
              <form onSubmit={handleInvitar} className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[240px]">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    placeholder="docente@universidad.edu"
                    value={correoInvitar}
                    onChange={(e) => setCorreoInvitar(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rol a Asignar</label>
                  <select
                    value={rolInvitar}
                    onChange={(e) => setRolInvitar(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="DOCENTE">Docente</option>
                    <option value="ADMIN_ORGANIZACION">Admin de Organización</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition"
                >
                  Generar Invitación
                </button>
              </form>

              {invitacionCreada && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 text-sm">
                  <p className="font-bold text-indigo-900">Enlace de Invitación Generado:</p>
                  <div className="p-2 bg-white rounded border border-indigo-200 font-mono text-xs text-indigo-800 select-all">
                    {window.location.origin}/unirse?token={invitacionCreada.token}
                  </div>
                  <p className="text-xs text-indigo-700">
                    Expira el: {new Date(invitacionCreada.fechaExpiracion).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Tabla de Invitaciones */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800">Historial de Invitaciones</h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Correo Invitado</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Expiración</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitaciones.map((inv) => (
                    <tr key={inv.idInvitacion} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-medium text-slate-800">{inv.correoInvitado}</td>
                      <td className="p-4 text-xs font-semibold text-slate-600">{inv.rolAsignado}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            inv.estado === 'PENDIENTE'
                              ? 'bg-amber-100 text-amber-700'
                              : inv.estado === 'ACEPTADA'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {inv.estado}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        {new Date(inv.fechaExpiracion).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        {inv.estado === 'PENDIENTE' && (
                          <button
                            onClick={() => handleRevocarInvitacion(inv.idInvitacion)}
                            className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-semibold transition"
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CÓDIGO DE ORGANIZACIÓN */}
        {tab === 'codigo' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 max-w-3xl">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Código de Organización (Método Alternativo)</h3>
              <p className="text-xs text-slate-500">
                Permite que los docentes se unan introduciendo un código. Los administradores controlan si requiere aprobación.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Código Actual</p>
                <p className="text-2xl font-mono font-bold text-indigo-600 tracking-wider">
                  {org?.codigoAcceso || 'SIN CÓDIGO GENERADO'}
                </p>
              </div>
              <button
                onClick={handleGenerarCodigo}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition"
              >
                {org?.codigoAcceso ? 'Regenerar Código' : 'Generar Código'}
              </button>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={codigoActivo}
                  onChange={(e) => setCodigoActivo(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800">Activar ingreso por código</span>
                  <p className="text-xs text-slate-500">Si está desactivado, nadie podrá unirse usando el código.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aprobacionRequerida}
                  onChange={(e) => setAprobacionRequerida(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800">Requerir aprobación de administrador</span>
                  <p className="text-xs text-slate-500">
                    Los docentes que ingresen con código quedarán como PENDIENTE hasta ser aprobados.
                  </p>
                </div>
              </label>

              <button
                onClick={handleGuardarConfigCodigo}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-lg transition"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: CONSUMO DE IA */}
        {tab === 'ia' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Dashboard de Consumo de IA</h3>
                <p className="text-xs text-slate-500">Detalle del consumo mensual por la organización.</p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-full">
                {usoIa?.plan || 'GRATUITO'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase">Solicitudes Exitosas</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{usoIa?.usadas || 0}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase">Solicitudes Disponibles</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{usoIa?.disponibles || 0}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase">Reinicio de Período</p>
                <p className="text-sm font-bold text-slate-700 mt-1">
                  {usoIa?.reiniciaPeriodo ? new Date(usoIa.reiniciaPeriodo).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
