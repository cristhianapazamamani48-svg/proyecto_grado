'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PreguntaExamen {
  id: string;
  tipo: 'OPCION_MULTIPLE' | 'SELECCION_MULTIPLE' | 'VERDADERO_FALSO' | 'ESPACIO_COMPLETAR' | 'RESPUESTA_ABIERTA';
  enunciado: string;
  imagenUrl?: string | null;
  puntaje: number;
  opciones: { id: string; texto: string }[];
  espacios: { id: string; posicion: number }[];
}

interface ReglasExamen {
  permitirRetroceder: boolean;
  permitirModificar: boolean;
  permitirDejarEnBlanco: boolean;
  mostrarResultados: boolean;
  mostrarRespuestas: boolean;
  permitirRevision: boolean;
  detectarCambioPestana: boolean;
  detectarClickDerecho: boolean;
  detectarCopiar: boolean;
  detectarPegar: boolean;
  detectarRedimensionar: boolean;
}

export default function ExamenPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const codigo = params.codigo as string;

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intentoId, setIntentoId] = useState('');
  const [nombreEstudiante, setNombreEstudiante] = useState('');
  const [nombreEvaluacion, setNombreEvaluacion] = useState('');
  const [preguntas, setPreguntas] = useState<PreguntaExamen[]>([]);
  const [indexPreguntaActual, setIndexPreguntaActual] = useState(0);
  const [respuestas, setRespuestas] = useState<
    Record<string, { opciones: string[]; texto?: string; espacios?: Record<string, string> }>
  >({});
  const [reglas, setReglas] = useState<ReglasExamen>({
    permitirRetroceder: true,
    permitirModificar: true,
    permitirDejarEnBlanco: true,
    mostrarResultados: true,
    mostrarRespuestas: false,
    permitirRevision: false,
    detectarCambioPestana: false,
    detectarClickDerecho: false,
    detectarCopiar: false,
    detectarPegar: false,
    detectarRedimensionar: false,
  });

  const [estadoSala, setEstadoSala] = useState<'PENDIENTE' | 'ACTIVA' | 'FINALIZADA'>('PENDIENTE');
  const [finalizado, setFinalizado] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [modoRevision, setModoRevision] = useState(false);

  // Estados de Cronómetro
  const [tiempoTotalSegundos, setTiempoTotalSegundos] = useState<number | null>(null);
  const [tiempoPorPreguntaSegundos, setTiempoPorPreguntaSegundos] = useState<number | null>(null);
  const [segundosRestantesTotal, setSegundosRestantesTotal] = useState<number | null>(null);
  const [segundosRestantesPregunta, setSegundosRestantesPregunta] = useState<number | null>(null);

  // Estado de Guardado e Infracciones
  const [guardandoAvance, setGuardandoAvance] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null);
  const [alertaMonitoreo, setAlertaMonitoreo] = useState<string | null>(null);

  const ultimoEventoRef = useRef<Record<string, number>>({});
  const timerTotalRef = useRef<NodeJS.Timeout | null>(null);
  const timerPreguntaRef = useRef<NodeJS.Timeout | null>(null);

  // Carga inicial del examen
  useEffect(() => {
    const cargarExamen = async () => {
      try {
        let token = localStorage.getItem('uub_guest_token');
        if (!token) {
          const tokenAcceso = localStorage.getItem('uub_token_reanudacion');
          if (!tokenAcceso) {
            router.push('/unirse');
            return;
          }
          const reanudacion = await fetch(`${API}/sesiones/reanudar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenAcceso }),
          });
          const datosReanudacion = await reanudacion.json();
          if (!reanudacion.ok) throw new Error(datosReanudacion.message || 'No fue posible reanudar la sesión.');
          token = datosReanudacion.token;
          localStorage.setItem('uub_guest_token', datosReanudacion.token);
        }

        // Consultar estado de la sala
        const estadoRes = await fetch(`${API}/sesiones/intento/estado`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const estadoData = await estadoRes.json();
        if (!estadoRes.ok) throw new Error(estadoData.message || 'No fue posible consultar la sala.');

        setEstadoSala(estadoData.estadoSesion);
        if (estadoData.estadoSesion !== 'ACTIVA') {
          setCargando(false);
          return;
        }

        // Iniciar / Reanudar Intento
        const res = await fetch(`${API}/sesiones/intento/iniciar`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al iniciar intento de examen');

        setIntentoId(data.intentoId);
        setNombreEstudiante(data.nombreParticipante || '');
        setNombreEvaluacion(data.nombreEvaluacion || '');
        setPreguntas(data.preguntas || []);
        if (data.reglas) setReglas(data.reglas);

        // Configuración de tiempos
        setTiempoTotalSegundos(data.tiempoTotal);
        setTiempoPorPreguntaSegundos(data.tiempoPorPregunta);

        if (data.tiempoRestanteTotal !== null && data.tiempoRestanteTotal !== undefined) {
          setSegundosRestantesTotal(data.tiempoRestanteTotal);
        } else if (data.tiempoTotal) {
          setSegundosRestantesTotal(data.tiempoTotal);
        }

        if (data.tiempoPorPregunta) {
          setSegundosRestantesPregunta(data.tiempoPorPregunta);
        }

        // Mapear respuestas previas
        const mapResp: Record<string, any> = {};
        if (data.respuestasGuardadas) {
          data.respuestasGuardadas.forEach((r: any) => {
            mapResp[r.preguntaId] = {
              opciones: r.opcionesSeleccionadas || [],
              texto: r.textoRespuesta || '',
              espacios: r.espaciosRespuestas || {},
            };
          });
        }
        setRespuestas(mapResp);
      } catch (err: any) {
        setError(err.message || 'Ocurrió un error al cargar la evaluación.');
      } finally {
        setCargando(false);
      }
    };

    cargarExamen();
  }, [codigo, router]);

  // Polling de sala de espera
  useEffect(() => {
    if (estadoSala !== 'PENDIENTE') return;
    const token = localStorage.getItem('uub_guest_token');
    if (!token) return;

    const intervalo = window.setInterval(async () => {
      try {
        const res = await fetch(`${API}/sesiones/intento/estado`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.estadoSesion === 'ACTIVA') {
          window.location.reload();
        }
      } catch {
        /* silent */
      }
    }, 2000);

    return () => window.clearInterval(intervalo);
  }, [estadoSala]);

  // Manejo de envío final de examen
  const ejecutarFinalizacion = useCallback(async () => {
    const token = localStorage.getItem('uub_guest_token');
    if (!token || !intentoId) return;

    setCargando(true);
    try {
      const res = await fetch(`${API}/sesiones/intento/finalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ intentoId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al finalizar evaluación');

      setResultado(data);
      setFinalizado(true);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al entregar la evaluación.');
    } finally {
      setCargando(false);
    }
  }, [intentoId]);

  // Cronómetro General (tiempoTotal)
  useEffect(() => {
    if (estadoSala !== 'ACTIVA' || finalizado || segundosRestantesTotal === null) return;

    timerTotalRef.current = setInterval(() => {
      setSegundosRestantesTotal((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerTotalRef.current!);
          ejecutarFinalizacion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerTotalRef.current) clearInterval(timerTotalRef.current);
    };
  }, [estadoSala, finalizado, segundosRestantesTotal, ejecutarFinalizacion]);

  // Cronómetro Por Pregunta (tiempoPorPregunta)
  useEffect(() => {
    if (estadoSala !== 'ACTIVA' || finalizado || !tiempoPorPreguntaSegundos) return;

    setSegundosRestantesPregunta(tiempoPorPreguntaSegundos);

    timerPreguntaRef.current = setInterval(() => {
      setSegundosRestantesPregunta((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          // Avanzar a la siguiente pregunta automáticamente
          setIndexPreguntaActual((curr) => {
            if (curr < preguntas.length - 1) {
              return curr + 1;
            } else {
              ejecutarFinalizacion();
              return curr;
            }
          });
          return tiempoPorPreguntaSegundos;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerPreguntaRef.current) clearInterval(timerPreguntaRef.current);
    };
  }, [indexPreguntaActual, estadoSala, finalizado, tiempoPorPreguntaSegundos, preguntas.length, ejecutarFinalizacion]);

  // Registro de Infracciones de Monitoreo
  const registrarInfraccion = useCallback(
    async (tipo: string, detalle?: string) => {
      const now = Date.now();
      const last = ultimoEventoRef.current[tipo] || 0;
      if (now - last < 3000) return; // Debounce de 3 segundos
      ultimoEventoRef.current[tipo] = now;

      // Mostrar alerta visual no invasiva
      const nombresEventos: Record<string, string> = {
        CAMBIO_PESTANA: 'Cambio de pestaña detectado',
        PERDIDA_FOCO: 'Pérdida de foco de la ventana',
        CLICK_DERECHO: 'Clic derecho bloqueado y registrado',
        COPIAR: 'Intento de copiar texto registrado',
        PEGAR: 'Intento de pegar texto registrado',
        REDIMENSIONAR: 'Redimensionamiento de ventana registrado',
      };
      setAlertaMonitoreo(nombresEventos[tipo] || `Evento ${tipo} registrado`);
      setTimeout(() => setAlertaMonitoreo(null), 4000);

      const token = localStorage.getItem('uub_guest_token');
      if (!token) return;

      try {
        await fetch(`${API}/sesiones/monitoreo/evento`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tipo, detalle }),
        });
      } catch {
        /* silent */
      }
    },
    [],
  );

  // Listeners de Monitoreo
  useEffect(() => {
    if (estadoSala !== 'ACTIVA' || finalizado) return;

    const handleVisibilityChange = () => {
      if (document.hidden && reglas.detectarCambioPestana) {
        registrarInfraccion('CAMBIO_PESTANA', 'El usuario cambió de pestaña o minimizó el navegador');
      }
    };

    const handleBlur = () => {
      if (reglas.detectarCambioPestana) {
        registrarInfraccion('PERDIDA_FOCO', 'El navegador perdió el foco');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (reglas.detectarClickDerecho) {
        e.preventDefault();
        registrarInfraccion('CLICK_DERECHO', 'Intento de abrir menú contextual');
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (reglas.detectarCopiar) {
        e.preventDefault();
        registrarInfraccion('COPIAR', 'Intento de copiar texto');
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (reglas.detectarPegar) {
        e.preventDefault();
        registrarInfraccion('PEGAR', 'Intento de pegar texto');
      }
    };

    const handleResize = () => {
      if (reglas.detectarRedimensionar) {
        registrarInfraccion('REDIMENSIONAR', `Ventana redimensionada a ${window.innerWidth}x${window.innerHeight}`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('resize', handleResize);
    };
  }, [estadoSala, finalizado, reglas, registrarInfraccion]);

  // Guardado de Respuestas en Servidor
  const guardarRespuestaServidor = async (
    preguntaId: string,
    opc: string[],
    texto?: string,
    espacios?: Record<string, string>,
  ) => {
    const token = localStorage.getItem('uub_guest_token');
    if (!token || !intentoId) return;

    setGuardandoAvance(true);
    try {
      const res = await fetch(`${API}/sesiones/intento/respuesta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          intentoId,
          preguntaId,
          opcionesSeleccionadas: opc,
          textoRespuesta: texto,
          espaciosRespuestas: espacios,
        }),
      });
      if (res.ok) {
        setUltimoGuardado(new Date());
      }
    } catch (e) {
      console.error('Error al guardar avance:', e);
    } finally {
      setGuardandoAvance(false);
    }
  };

  const handleSeleccionarOpcion = (preguntaId: string, opcionId: string, esMultiple: boolean) => {
    // Si no se permite modificar y ya hay respuesta guardada
    if (!reglas.permitirModificar && respuestas[preguntaId]?.opciones?.length > 0) {
      return;
    }

    const actual = respuestas[preguntaId] || { opciones: [] };
    let nuevasOpciones: string[] = [];

    if (esMultiple) {
      if (actual.opciones.includes(opcionId)) {
        nuevasOpciones = actual.opciones.filter((id) => id !== opcionId);
      } else {
        nuevasOpciones = [...actual.opciones, opcionId];
      }
    } else {
      nuevasOpciones = [opcionId];
    }

    const nuevaMap = {
      ...respuestas,
      [preguntaId]: { ...actual, opciones: nuevasOpciones },
    };
    setRespuestas(nuevaMap);
    guardarRespuestaServidor(preguntaId, nuevasOpciones, actual.texto, actual.espacios);
  };

  const handleTextoAbierto = (preguntaId: string, texto: string) => {
    const actual = respuestas[preguntaId] || { opciones: [] };
    const nuevaMap = {
      ...respuestas,
      [preguntaId]: { ...actual, texto },
    };
    setRespuestas(nuevaMap);
    guardarRespuestaServidor(preguntaId, actual.opciones, texto, actual.espacios);
  };

  const handleEspacioCompletar = (preguntaId: string, posicion: number, valor: string) => {
    const actual = respuestas[preguntaId] || { opciones: [], espacios: {} };
    const nuevosEspacios = { ...(actual.espacios || {}), [posicion]: valor };

    const nuevaMap = {
      ...respuestas,
      [preguntaId]: { ...actual, espacios: nuevosEspacios },
    };
    setRespuestas(nuevaMap);
    guardarRespuestaServidor(preguntaId, actual.opciones, actual.texto, nuevosEspacios);
  };

  // Formato de Tiempo (MM:SS o HH:MM:SS)
  const formatearTiempo = (segundosTotales: number | null) => {
    if (segundosTotales === null || segundosTotales === undefined) return '--:--';
    const hrs = Math.floor(segundosTotales / 3600);
    const mins = Math.floor((segundosTotales % 3600) / 60);
    const segs = segundosTotales % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${segs < 10 ? '0' : ''}${segs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${segs < 10 ? '0' : ''}${segs}`;
  };

  // Validación de Dejar en Blanco
  const preguntaActualTieneRespuesta = () => {
    const preg = preguntas[indexPreguntaActual];
    if (!preg) return true;
    const resp = respuestas[preg.id];
    if (!resp) return false;

    if (preg.tipo === 'OPCION_MULTIPLE' || preg.tipo === 'SELECCION_MULTIPLE' || preg.tipo === 'VERDADERO_FALSO') {
      return resp.opciones && resp.opciones.length > 0;
    }
    if (preg.tipo === 'ESPACIO_COMPLETAR') {
      return resp.espacios && Object.values(resp.espacios).some((v) => v && v.trim().length > 0);
    }
    if (preg.tipo === 'RESPUESTA_ABIERTA') {
      return Boolean(resp.texto && resp.texto.trim().length > 0);
    }
    return true;
  };

  // Vistas de Estado
  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 font-semibold text-sm">Cargando evaluación...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            ✕
          </div>
          <h2 className="text-xl font-bold text-slate-900">Aviso del Sistema</h2>
          <p className="text-slate-600 text-sm leading-relaxed">{error}</p>
          <button
            onClick={() => router.push('/unirse')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full transition-colors"
          >
            Volver a Ingresar
          </button>
        </div>
      </main>
    );
  }

  // Vista: Sala de Espera
  if (estadoSala === 'PENDIENTE') {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 p-10 rounded-3xl max-w-md w-full text-center space-y-6 shadow-sm">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-sm">
            ⏳
          </div>
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
              Sala de Espera
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-3">
              {nombreEvaluacion || 'Evaluación Académica'}
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              Hola, <span className="font-semibold text-slate-800">{nombreEstudiante || 'Estudiante'}</span>. Tu ingreso ha sido registrado exitosamente.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-sm">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-ping" />
              Esperando que el docente inicie el examen
            </div>
            <p className="text-xs text-slate-400">La página comenzará automáticamente cuando la sesión esté activa.</p>
          </div>

          <div className="pt-2">
            <span className="text-xs font-mono text-slate-400">Código de Sesión: {codigo}</span>
          </div>
        </div>
      </main>
    );
  }

  // Vista: Pantalla de Finalización
  if (finalizado && resultado) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 p-10 rounded-3xl max-w-xl w-full text-center space-y-6 shadow-sm">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-sm">
            ✓
          </div>
          <div>
            <span className="text-xs font-bold text-green-700 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full">
              Examen Entregado
            </span>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mt-3">Evaluación Finalizada</h1>
            <p className="text-slate-500 text-sm mt-2">
              Todas tus respuestas han sido guardadas y registradas en el sistema.
            </p>
          </div>

          {resultado.mostrarResultados ? (
            <div className="p-6 bg-blue-50/60 border border-blue-100 rounded-3xl space-y-3">
              <p className="text-xs text-blue-600 uppercase font-bold tracking-widest">Resultado Obtenido</p>
              <p className="text-5xl font-black text-slate-900">{resultado.notaFinal}%</p>
              <p className="text-sm font-semibold text-slate-600">
                Puntaje: {resultado.puntajeTotalObtenido} / {resultado.puntajeMaximoPosible} pts
              </p>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 text-sm">
              Los resultados detallados y notas serán publicados por el docente al concluir la sesión.
            </div>
          )}

          {/* Mostrar Respuestas Correctas si está permitido */}
          {resultado.mostrarRespuestas && resultado.respuestasCorrectas && (
            <div className="text-left space-y-3 pt-2">
              <button
                onClick={() => setModoRevision(!modoRevision)}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center justify-between w-full p-2 bg-slate-50 rounded-xl"
              >
                <span>{modoRevision ? '▲ Ocultar respuestas correctas' : '▼ Ver respuestas correctas del examen'}</span>
              </button>

              {modoRevision && (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {resultado.respuestasCorrectas.map((r: any, idx: number) => (
                    <div key={r.idPregunta} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-slate-800">
                        {idx + 1}. {r.enunciado}
                      </p>
                      {r.opcionesCorrectas?.length > 0 && (
                        <p className="text-green-700 font-semibold">
                          Correcta: {r.opcionesCorrectas.join(', ')}
                        </p>
                      )}
                      {r.espaciosValidos?.length > 0 && (
                        <p className="text-green-700 font-semibold">
                          Espacios válidos: {r.espaciosValidos.map((e: any) => `[${e.numeroEspacio}]: ${e.respuestas.join(' / ')}`).join(' | ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-4">
            <Link
              href="/"
              className="inline-block w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-500/25 transition-colors"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Vista Principal del Examen
  const pregActual = preguntas[indexPreguntaActual];
  const respActual = pregActual ? respuestas[pregActual.id] || { opciones: [], texto: '', espacios: {} } : null;

  const tiempoRestanteActivo =
    tiempoPorPreguntaSegundos !== null ? segundosRestantesPregunta : segundosRestantesTotal;

  const esTiempoCritico =
    tiempoRestanteActivo !== null &&
    ((tiempoPorPreguntaSegundos && tiempoRestanteActivo <= 15) || (!tiempoPorPreguntaSegundos && tiempoRestanteActivo <= 120));

  const esTiempoAdvertencia =
    tiempoRestanteActivo !== null &&
    ((tiempoPorPreguntaSegundos && tiempoRestanteActivo <= 30) || (!tiempoPorPreguntaSegundos && tiempoRestanteActivo <= 300));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none">
      {/* Alerta de Infracción */}
      {alertaMonitoreo && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 bg-amber-500 text-white font-bold text-xs rounded-full shadow-xl flex items-center gap-2 animate-bounce">
          <span>⚠️</span>
          <span>{alertaMonitoreo}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-blue-500/30">
            U
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none">
              {nombreEvaluacion || 'Evaluación Académica'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Estudiante: {nombreEstudiante}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Cronómetro */}
          {tiempoRestanteActivo !== null && (
            <div
              className={`px-4 py-2 rounded-full font-mono font-black text-sm flex items-center gap-2 transition-all ${
                esTiempoCritico
                  ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
                  : esTiempoAdvertencia
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              <span>⏱️</span>
              <span>{formatearTiempo(tiempoRestanteActivo)}</span>
              {tiempoPorPreguntaSegundos && <span className="text-[10px] font-sans font-normal">(por preg)</span>}
            </div>
          )}

          {/* Estado de Guardado */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            {guardandoAvance ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Guardando...</span>
              </>
            ) : ultimoGuardado ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>Guardado</span>
              </>
            ) : null}
          </div>

          {/* Botón Entregar */}
          <button
            onClick={() => {
              if (confirm('¿Estás seguro de que deseas finalizar y entregar tu evaluación?')) {
                ejecutarFinalizacion();
              }
            }}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full shadow-md shadow-red-500/20 transition-colors"
          >
            Entregar Examen
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col justify-between space-y-6">
        {/* Stepper / Navegador de Preguntas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 flex-wrap">
            {preguntas.map((p, idx) => {
              const resp = respuestas[p.id];
              const respondida =
                (resp?.opciones && resp.opciones.length > 0) ||
                (resp?.texto && resp.texto.trim().length > 0) ||
                (resp?.espacios && Object.values(resp.espacios).some((v) => v && v.trim().length > 0));

              const esActual = idx === indexPreguntaActual;
              const puedeNavegar = reglas.permitirRetroceder || idx >= indexPreguntaActual;

              return (
                <button
                  key={p.id}
                  disabled={!puedeNavegar}
                  onClick={() => setIndexPreguntaActual(idx)}
                  className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                    esActual
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-600/30'
                      : respondida
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="text-right flex-shrink-0 text-xs font-semibold text-slate-400">
            Pregunta {indexPreguntaActual + 1} de {preguntas.length}
          </div>
        </div>

        {/* Tarjeta de Pregunta Actual */}
        {pregActual && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
            {/* Header de Pregunta */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
                {pregActual.tipo.replace(/_/g, ' ')}
              </span>
              <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                Puntaje: {pregActual.puntaje} pts
              </span>
            </div>

            {/* Enunciado e Imagen */}
            <div className="space-y-4">
              {pregActual.tipo !== 'ESPACIO_COMPLETAR' || !/\[_\d+_\]/.test(pregActual.enunciado) ? (
                <h2 className="text-xl font-bold text-slate-900 leading-relaxed">{pregActual.enunciado}</h2>
              ) : null}

              {pregActual.imagenUrl && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-64 flex justify-center p-2">
                  <img src={pregActual.imagenUrl} alt="Pregunta" className="object-contain h-full rounded-xl" />
                </div>
              )}
            </div>

            {/* Tipos de Preguntas */}
            <div className="pt-2">
              {/* Opción Múltiple / Verdadero Falso */}
              {(pregActual.tipo === 'OPCION_MULTIPLE' || pregActual.tipo === 'VERDADERO_FALSO') && (
                <div className="space-y-3">
                  {pregActual.opciones.map((opc) => {
                    const seleccionada = respActual?.opciones.includes(opc.id);
                    return (
                      <button
                        key={opc.id}
                        type="button"
                        onClick={() => handleSeleccionarOpcion(pregActual.id, opc.id, false)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                          seleccionada
                            ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold shadow-sm'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-sm font-medium">{opc.texto}</span>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            seleccionada ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                          }`}
                        >
                          {seleccionada && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selección Múltiple */}
              {pregActual.tipo === 'SELECCION_MULTIPLE' && (
                <div className="space-y-3">
                  <p className="text-xs text-blue-600 font-bold mb-2">Selecciona todas las respuestas correctas:</p>
                  {pregActual.opciones.map((opc) => {
                    const seleccionada = respActual?.opciones.includes(opc.id);
                    return (
                      <button
                        key={opc.id}
                        type="button"
                        onClick={() => handleSeleccionarOpcion(pregActual.id, opc.id, true)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                          seleccionada
                            ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold shadow-sm'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-sm font-medium">{opc.texto}</span>
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                            seleccionada ? 'border-blue-600 bg-blue-600 text-white font-bold text-xs' : 'border-slate-300'
                          }`}
                        >
                          {seleccionada && '✓'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Completar Espacios */}
              {pregActual.tipo === 'ESPACIO_COMPLETAR' && (
                <div className="space-y-6">
                  {/\[_\d+_\]/.test(pregActual.enunciado) ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-medium text-slate-800 leading-loose">
                      {pregActual.enunciado.split(/(\[_\d+_\])/g).map((part, idx) => {
                        const match = part.match(/\[_(\d+)_\]/);
                        if (match) {
                          const pos = parseInt(match[1], 10);
                          return (
                            <input
                              key={idx}
                              type="text"
                              value={respActual?.espacios?.[pos] || ''}
                              onChange={(e) => handleEspacioCompletar(pregActual.id, pos, e.target.value)}
                              placeholder={`Espacio #${pos}`}
                              className="inline-block mx-1.5 px-3 py-1 bg-white border-2 border-blue-400 focus:border-blue-600 rounded-xl text-slate-900 font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[130px] max-w-[200px]"
                            />
                          );
                        }
                        return <span key={idx}>{part}</span>;
                      })}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-blue-600 font-bold">Completa los espacios requeridos:</p>
                      {pregActual.espacios.map((esp) => (
                        <div key={esp.id} className="space-y-1">
                          <label className="block text-xs font-bold text-slate-600">Espacio #{esp.posicion}</label>
                          <input
                            type="text"
                            value={respActual?.espacios?.[esp.posicion] || ''}
                            onChange={(e) => handleEspacioCompletar(pregActual.id, esp.posicion, e.target.value)}
                            placeholder="Escribe tu respuesta..."
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Respuesta Abierta */}
              {pregActual.tipo === 'RESPUESTA_ABIERTA' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase">Desarrolla tu respuesta:</label>
                  <textarea
                    rows={6}
                    value={respActual?.texto || ''}
                    onChange={(e) => handleTextoAbierto(pregActual.id, e.target.value)}
                    placeholder="Escribe detalladamente tu explicación o desarrollo aquí..."
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm leading-relaxed"
                  />
                  <div className="text-right text-[11px] text-slate-400">
                    {(respActual?.texto || '').trim().split(/\s+/).filter(Boolean).length} palabras
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer de Navegación */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <button
            type="button"
            disabled={indexPreguntaActual === 0 || !reglas.permitirRetroceder}
            onClick={() => setIndexPreguntaActual((prev) => prev - 1)}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>

          <span className="text-xs font-bold text-slate-400">
            {indexPreguntaActual + 1} de {preguntas.length}
          </span>

          {indexPreguntaActual < preguntas.length - 1 ? (
            <button
              type="button"
              disabled={!reglas.permitirDejarEnBlanco && !preguntaActualTieneRespuesta()}
              onClick={() => setIndexPreguntaActual((prev) => prev + 1)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full shadow-md shadow-blue-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          ) : (
            <button
              type="button"
              disabled={!reglas.permitirDejarEnBlanco && !preguntaActualTieneRespuesta()}
              onClick={() => {
                if (confirm('Has llegado al final. ¿Deseas entregar la evaluación?')) {
                  ejecutarFinalizacion();
                }
              }}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-full shadow-md shadow-green-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Entregar Evaluación ✓
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
