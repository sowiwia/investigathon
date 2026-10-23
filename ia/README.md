# Documentación del uso de IA

Esta carpeta reúne las conversaciones con IA mantenidas durante la
investigación que contribuyeron a los resultados obtenidos.

## Procedimiento

Las sesiones se realizaron con Claude (Opus 5.5). Al finalizar cada
conversación se solicitó su exportación completa en texto plano mediante el
siguiente prompt:

> Exportá toda nuestra conversación en un archivo .txt, completa y en orden,
> sin resumir ni reescribir nada. Marcá cada turno con "YO:" y "CLAUDE:".
> Que sea simple, sin separadores, sólo la conversación.

El archivo resultante se almacena en `sesiones/`.

## Convenciones

- Un archivo por conversación, ubicado en `sesiones/`.
- Nomenclatura: `conversacion_<tema>.txt`.
- Estructura interna: título en el encabezado, seguido de los turnos
  alternados `YO:` / `CLAUDE:`.

## Registro de sesiones

| Archivo | Tema |
|---|---|
| `sesiones/conversacion_kuramoto_semaforos.txt` | Traducción del paper de Nishikawa (2003), sincronización tipo Kuramoto y su aplicación a semáforos |
