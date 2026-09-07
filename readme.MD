# Sistema Web de Evaluaciones Académicas — Versión mejorada del diseño

> Este documento parte del diseño original y añade las correcciones/ajustes detectados en la revisión. Los cambios respecto a la versión original están marcados con **[AJUSTE]**.

## 1. Tipos de usuarios

Se mantiene la estructura original (Super Administrador y Docente con los mismos permisos por ahora).

**[AJUSTE]** Se separa formalmente el concepto de **usuario administrador** (Docente/SuperAdmin) del concepto de **estudiante con cuenta**. Son entidades distintas porque:
- Tienen ciclos de vida y flujos de autenticación distintos (el estudiante se registra para ver su historial, no para administrar el sistema).
- Mezclarlos en una sola tabla `usuario` con un rol `ESTUDIANTE` obligaría a que esa tabla cargue con reglas de negocio de dos mundos distintos (permisos administrativos vs. historial académico).

### Nueva entidad: Estudiante
Información registrada:
- nombre, apellido
- correo (único)
- contraseña cifrada
- estado
- fecha de creación

## 2. Módulo de Participantes **[AJUSTE]**

Se mantienen las dos formas de ingreso, pero ahora ambas quedan representadas en el modelo de datos:

**Sin cuenta**
- código de sesión + nombre completo
- **[AJUSTE]** se genera un *token de reanudación* para que, si el participante pierde la conexión, pueda retomar el examen desde donde quedó sin perder su avance.

**Con cuenta**
- El participante queda vinculado a la entidad Estudiante mediante una referencia opcional.
- El nombre se sigue guardando en el registro de `participante` como una copia histórica del momento del examen (aunque el estudiante luego cambie su nombre en su perfil, el registro académico no debe alterarse retroactivamente).

## 3. Configuración de la evaluación **[AJUSTE]**

### Inicio (corregido)
El diseño original solo permitía distinguir "inmediato" vs "programado" mediante un booleano, pero el texto describe **tres modos**. Se corrige a:

- `INMEDIATO`: la evaluación está disponible apenas se activa la sesión.
- `PROGRAMADO`: requiere `fecha_inicio` y `fecha_fin` a nivel de evaluación/sesión.
- `POR_PARTICIPANTE`: el cronómetro de cada estudiante inicia en el momento en que él mismo ingresa (independiente del resto).

### Visualización (corregido)
Se agregan las **tres** opciones documentadas (antes solo existían dos):
- ver nota final
- ver respuestas correctas
- **[AJUSTE]** volver a revisar la evaluación completa después de finalizar

### Tiempo
**[AJUSTE]** Se deja explícito como regla de negocio: `tiempo_total` y `tiempo_por_pregunta` son mutuamente excluyentes (no tiene sentido activar ambos a la vez). Esto se refuerza a nivel de base de datos con una restricción `CHECK`.

## 4. Integridad de evaluaciones ya aplicadas **[AJUSTE — nuevo]**

Riesgo detectado: si una evaluación se edita (preguntas, puntajes, respuestas correctas) después de que ya existen sesiones con respuestas calificadas, los resultados históricos pueden quedar inconsistentes con la definición actual del examen.

Regla de negocio propuesta:
- Una evaluación en estado `PUBLICADA` que ya tiene al menos una sesión con participantes que respondieron, **no debería permitir edición estructural** (agregar/quitar preguntas, cambiar opciones correctas, cambiar puntajes).
- Si el docente necesita modificarla, el sistema debe ofrecer la opción de **duplicar la evaluación** como una nueva versión, preservando intacta la original y sus resultados.
- Esta regla se sugiere implementar en la capa de aplicación (y opcionalmente reforzar con un trigger de base de datos, ver script SQL).

## 5. Banco de preguntas **[AJUSTE — limitación explícita]**

Se mantiene la decisión de que una pregunta pertenece exclusivamente a una evaluación (no hay banco de preguntas compartido). Se dejará documentado como limitación consciente del alcance actual, no como un olvido, para que quede claro en el SRS que es candidato a una fase futura (ej. tabla intermedia `evaluacion_pregunta` si se decide compartir preguntas entre evaluaciones).

## 6. Corrección de respuestas abiertas **[AJUSTE]**

Se añade trazabilidad: quién corrigió (`usuario`) y cuándo (`fecha_correccion`), no solo el booleano de si ya fue corregida. Esto es importante incluso con un solo docente, porque documenta el momento de la corrección para fines de auditoría y reportes.

## 7. Espacio_Completar — modo de calificación **[AJUSTE]**

Se especifica un conjunto cerrado de modos de calificación por espacio, en lugar de dejarlo como concepto abierto sin valores definidos:
- `EXACTA`: coincidencia literal (respetando o no mayúsculas según configuración)
- `CONTIENE`: la respuesta del estudiante contiene el texto válido
- (Extensible en el futuro a `REGEX` u otros modos sin romper el modelo)

## 8. Recomendación

Se mantiene la recomendación original del arquitecto: antes de programar, formalizar estas reglas en un documento SRS (requisitos funcionales, no funcionales, reglas de negocio, casos de uso). Los ajustes de este documento deberían incorporarse directamente en esa versión formal.