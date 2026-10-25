export interface PlantillaCorreo {
  subject: string;
  html: string;
  text: string;
}

const escaparHtml = (valor: string | number): string =>
  String(valor).replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[caracter] || caracter);

export function plantillaReciboPago(datos: {
  nombre: string;
  plan: string;
  monto: string | number;
  moneda: string;
  periodoCubierto: string;
  numeroComprobante: string;
  invoiceUrl?: string;
}): PlantillaCorreo {
  const nombre = escaparHtml(datos.nombre);
  const plan = escaparHtml(datos.plan);
  const monto = escaparHtml(datos.monto);
  const moneda = escaparHtml(datos.moneda);
  const periodo = escaparHtml(datos.periodoCubierto);
  const comprobante = escaparHtml(datos.numeroComprobante);
  const factura = datos.invoiceUrl ? escaparHtml(datos.invoiceUrl) : undefined;

  return {
    subject: `Recibo de pago ${comprobante}`,
    html: `<p>Hola ${nombre},</p><p>Recibimos tu pago del plan <strong>${plan}</strong>.</p><ul><li>Monto: ${monto} ${moneda}</li><li>Periodo cubierto: ${periodo}</li><li>Comprobante: ${comprobante}</li></ul>${factura ? `<p><a href="${factura}">Ver factura</a></p>` : ''}`,
    text: `Hola ${datos.nombre}. Recibimos tu pago del plan ${datos.plan}. Monto: ${datos.monto} ${datos.moneda}. Periodo cubierto: ${datos.periodoCubierto}. Comprobante: ${datos.numeroComprobante}.${datos.invoiceUrl ? ` Factura: ${datos.invoiceUrl}` : ''}`,
  };
}

export function plantillaAvisoVencimiento(datos: {
  nombre: string;
  plan: string;
  diasRestantes: number;
  fechaVencimiento: string;
  enlaceRenovacion: string;
}): PlantillaCorreo {
  const nombre = escaparHtml(datos.nombre);
  const plan = escaparHtml(datos.plan);
  const dias = escaparHtml(datos.diasRestantes);
  const fecha = escaparHtml(datos.fechaVencimiento);
  const enlace = escaparHtml(datos.enlaceRenovacion);

  return {
    subject: `Tu plan ${plan} vence en ${dias} dia(s)`,
    html: `<p>Hola ${nombre},</p><p>Tu plan <strong>${plan}</strong> vence en ${dias} dia(s), el ${fecha}.</p><p><a href="${enlace}">Renovar plan</a></p>`,
    text: `Hola ${datos.nombre}. Tu plan ${datos.plan} vence en ${datos.diasRestantes} dia(s), el ${datos.fechaVencimiento}. Renueva en: ${datos.enlaceRenovacion}`,
  };
}

export function plantillaRecuperacionPassword(datos: { nombre: string; enlace: string }): PlantillaCorreo {
  const nombre = escaparHtml(datos.nombre);
  const enlace = escaparHtml(datos.enlace);

  return {
    subject: 'Restablece tu contrasena',
    html: `<p>Hola ${nombre},</p><p>Solicitaste restablecer tu contrasena. Este enlace vence en 1 hora.</p><p><a href="${enlace}">Restablecer contrasena</a></p><p>Si no hiciste esta solicitud, puedes ignorar este correo.</p>`,
    text: `Hola ${datos.nombre}. Solicitaste restablecer tu contrasena. Este enlace vence en 1 hora: ${datos.enlace}. Si no hiciste esta solicitud, puedes ignorar este correo.`,
  };
}
