# Sincronización de osciladores acoplados en redes de tráfico urbano

> **Investigathón 2026**: Track de Optimización<br>
> Facultad de Ciencias Exactas y Naturales, Universidad de Buenos Aires

[![Demo interactiva](https://img.shields.io/badge/Demo_interactiva-000000.svg?style=flat)](https://sowiwia.github.io/investigathon/sincro-ba/)

## El problema

El trabajo parte del problema *Conectividad crítica para la sincronización global en el
modelo de Kuramoto* y lo estudia desde su costado aplicado: la coordinación de una red de
semáforos, donde cada intersección es un oscilador de fase acoplado a sus vecinas
(Nishikawa, Nakazawa y Kita, 2003).

## Qué se hizo

Se simuló el modelo sobre redes idealizadas de una y dos manos, se barrió el acople entre
calles para ver cuándo la red deja de coordinarse, y se lo aplicó a dos corredores reales
del Microcentro con datos de tránsito de la Ciudad. Todo eso está en los notebooks, en la
simulación interactiva, y explicado en el informe y el póster.

## Contenido

| Carpeta | Contenido |
|---|---|
| [`informe/`](informe) | Informe final en PDF |
| [`poster/`](poster) | Póster de la presentación |
| [`simulaciones/`](simulaciones) | Notebook base: integración del modelo, redes idealizadas de una y dos manos, barridos de acople |
| [`aplicaciones_ciudad/`](aplicaciones_ciudad) | Datos de tránsito de BA Data y simulación de dos corredores reales del Microcentro |
| [`sincro-ba/`](sincro-ba) | Simulación interactiva en el navegador, con el mapa del Microcentro |
| [`ia/`](ia) | Declaración y registro del uso de IA |
