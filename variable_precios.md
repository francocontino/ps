# Variables de precios

Definí la modalidad de ganancia con `[suma_fija]`:

- `N`: el valor de `[ganancia]` se aplica como porcentaje.
- `S`: el valor de `[ganancia]` se suma como monto fijo en USD.

Ejemplos para un precio de USD 100:

- `[suma_fija]: N` y `[ganancia]: 5` muestra USD 105.
- `[suma_fija]: S` y `[ganancia]: 5` también muestra USD 105, sumando USD 5 a cualquier producto.

Elige si el widget muestra o no el precio de venta, S es sí mostrar, N es no mostrar.

Elige si el widget muestra o no las unidades disponibles para cada modelo. ejemplo "(3 uds) de Iphone 15 PRO MAX 256 black..."

[ganancia]: 20
[suma_fija]: S
[mostrar_precio]: S
[mostrar_uds_dispo]: N
