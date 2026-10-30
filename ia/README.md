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
| `sesiones/conversacion_mapas_y_circuito.txt` | Elección del circuito y de los sensores sobre los conteos de BA Data, distancias entre cruces, mapas y grafo del Microcentro a partir de OpenStreetMap |


## Qué hizo la IA y qué hicimos nosotros

La especificación de la simulación, los notebooks de análisis y sus figuras,
la redacción del informe y del poster y la elección de los parámetros del
modelo son nuestros. La IA tradujo el paper, buscó la bibliografía, eligió el
circuito y los sensores sobre el dataset de conteos, generó los mapas y el
grafo del Microcentro y ayudó a escribir y corregir el código de la interfaz de `sincro-ba` según nuestra
especificación y elementos visuales.
