# Anuncios de Meta — sección para el panel de Plan Car

Muestra de la sección que pidió Agustín: estado de los anuncios de Meta con
**alcance y leads por anuncio**.

```
panel-anuncios-meta/index.html   ← abrir con doble clic
```

Es un HTML suelto, sin dependencias. Los datos son de ejemplo, cargados en el
array `ANUNCIOS` y la serie `SERIE_14` arriba del `<script>`.

---

## Qué muestra

- **Cuatro números arriba:** alcance, leads, costo por lead e inversión, con la
  variación contra el período anterior.
- **Leads por día:** la curva, con el detalle al pasar el mouse. El botón
  "Ver datos" abre la tabla, para quien prefiera los números.
- **Por anuncio:** cada anuncio con su estado, alcance, leads y costo por lead,
  ordenado por el que más trae.
- **Filtro de período** arriba a la derecha: 7, 14 o 30 días.

Está armado con la paleta de la landing de Plan Car. Los colores salen de
variables en `:root` — si el panel real tiene otra identidad, se cambian ahí y
listo, no hay que tocar nada más.

---

## Qué tan complejo es conectarlo de verdad

La respuesta corta: **el alcance es fácil, los leads son el trabajo real.**

### Alcance, impresiones e inversión — directo de Meta

Una llamada a la Marketing API alcanza:

```
GET /v21.0/act_<AD_ACCOUNT_ID>/insights
  ?level=ad
  &fields=ad_id,ad_name,campaign_name,reach,impressions,spend
  &time_range={"since":"2026-10-24","until":"2026-11-06"}
```

Hace falta:
- La cuenta publicitaria en Business Manager (ya está, son los anuncios nuestros).
- Una app de Meta con permiso `ads_read`.
- Un token de usuario de sistema, que no vence.

Eso es cuestión de horas, no de días. Un cron cada 30 minutos guarda el resultado
y el panel lee de ahí — así no se pega contra la API en cada carga ni se choca
con los límites.

### Leads — depende del tipo de anuncio

Acá está la parte que hay que pensar:

**Si el anuncio usa formulario nativo de Meta (Lead Ads):** el lead viene en el
mismo `insights`, dentro de `actions` como `lead`. No hay nada más que hacer.

**Si el anuncio va a WhatsApp (que es nuestro caso):** Meta **no** cuenta eso
como lead. En `insights` figura como clic, nada más. El lead hay que contarlo de
nuestro lado.

Cómo se hace: cuando alguien toca "Enviar mensaje" en el anuncio y escribe, el
primer mensaje llega al webhook con un objeto `referral`:

```json
"referral": {
  "source_type": "ad",
  "source_id": "238...401",
  "ctwa_clid": "ARZ1x...",
  "headline": "Plan Flex — Río Grande"
}
```

Ese `source_id` es el id del anuncio. Hay que guardarlo en el lead del CRM al
crearlo, y después el panel cruza por ese campo.

**Dos cosas importantes:**
- El `referral` viene **solo en el primer mensaje** de la conversación. Si no se
  guarda ahí, se perdió: no hay forma de recuperarlo después.
- Sin eso, el panel puede mostrar alcance y clics, pero la columna de leads
  queda vacía. No hay manera de sacarla de Meta.

### Entonces

| Parte | Esfuerzo |
|---|---|
| La pantalla (esto) | hecho |
| Alcance, inversión, costo por lead | bajo — una llamada a la API + un cron |
| Leads de Lead Ads | bajo — viene en la misma llamada |
| Leads de WhatsApp | medio — guardar el `referral` del primer mensaje y cruzarlo |

Lo bueno: el guardado del `referral` es exactamente lo mismo que necesita el
agente de WhatsApp para saber por qué anuncio entró la consulta. Se hace una vez
y sirve para las dos cosas.

---

## Para pasar a datos reales

El panel espera un objeto así:

```json
{
  "periodo": { "desde": "2026-10-24", "hasta": "2026-11-06" },
  "anuncios": [
    {
      "id": "238...401",
      "nombre": "Plan Flex — Río Grande",
      "campania": "TDF-FLEX-NOV",
      "estado": "activo",
      "alcance": 14820,
      "leads": 24,
      "gasto": 86400
    }
  ],
  "serie_leads": [3, 5, 2, 4, 6, 8, 5, 3, 7, 9, 6, 4, 8, 7]
}
```

`alcance` y `gasto` salen de Meta; `leads` y `serie_leads` salen del CRM contando
por `source_id`. Reemplazar las dos constantes del principio por un `fetch` y
queda andando.
