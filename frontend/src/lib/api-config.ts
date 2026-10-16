/**
 * Determina dinámicamente la URL base del API.
 *
 * Si estamos en el navegador y el frontend se abre desde una IP local (ej. 192.168.x.x o 10.x.x.x),
 * apuntamos al puerto 3001 del mismo host donde corre el navegador para que funcione en red local
 * sin necesidad de reconfigurar variables de entorno estáticas con 'localhost'.
 */
export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Si se accede vía IP de red local (ej. 192.168.x.x o 10.x.x.x), usar esa misma IP en puerto 3001
    if (/^(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(hostname)) {
      return `http://${hostname}:3001`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

export function getWsUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (/^(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(hostname)) {
      return `http://${hostname}:3001`;
    }
  }
  return process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
}
