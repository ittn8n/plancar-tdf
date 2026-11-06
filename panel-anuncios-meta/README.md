# Campañas — Anuncios de Meta

Sección para el panel de Plan Car, en **Reportes comerciales → Campañas**.

Muestra, por anuncio: **estado, alcance, cantidad de leads y costo por lead**,
con **filtro de marca** y **filtro de período**.

```
reportes-campanias/index.html   ← la página
```

Es un HTML suelto, sin dependencias ni build. No pisa nada de lo que ya está en
el panel: se copia en una carpeta nueva y se le agrega un link al menú.

---

## Instalación en cPanel

1. Entrar a **cPanel → Administrador de archivos**.
2. Ir a la carpeta del panel (normalmente `public_html/` o la del subdominio).
3. **Subir** `plancar-campanias.zip`.
4. Clic derecho sobre el zip → **Extract**.
5. Borrar el `.zip` del servidor.

Queda `reportes-campanias/` como carpeta nueva. **No toca ningún archivo
existente**: el zip trae una sola carpeta, con nombre propio, y nada en la raíz.

Verificar en: `https://tudominio.com/reportes-campanias/`

### El único cambio manual: el link en el menú

En el archivo del menú del panel, agregar un ítem dentro de Reportes comerciales:

```html
<a href="/reportes-campanias/">Campañas</a>
```

Si el menú se arma desde PHP o desde una tabla, agregar la entrada como
corresponda en ese lugar. Es una línea; no hay que modificar nada más.

---

## Filtros

**Marca.** Se arma solo a partir del campo `marca` de cada anuncio: si mañana se
suma otra terminal, aparece en el filtro sin tocar código. Afecta a todo la vez
—los cuatro números de arriba, la curva y la tabla.

> **A confirmar con Agustín:** en los datos de muestra puse Volkswagen, Fiat y
> Chevrolet para que se vea el filtro funcionando. Si Plan Car trabaja otras
> marcas (o solo Volkswagen), se cambia el campo `marca` en el array `ANUNCIOS`
> y listo.

**Período.** 7, 14 o 30 días. Los porcentajes de variación comparan contra el
período inmediatamente anterior del mismo largo: 14 días contra los 14 previos.

Un anuncio pausado deja de sumar desde el día que se pausó. Por eso, por
ejemplo, al filtrar Fiat en 7 días da cero: ese anuncio está pausado hace 9 días.
Es correcto, no es un error.

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
  &time_increment=1
```

`time_increment=1` devuelve el desglose por día, que es lo que necesita la curva.

Hace falta:
- La cuenta publicitaria en Business Manager (ya está, son los anuncios nuestros).
- Una app de Meta con permiso `ads_read`.
- Un token de usuario de sistema, que no vence.

Es cuestión de horas. Un cron cada 30 minutos guarda el resultado en la base y el
panel lee de ahí — así no se pega contra la API en cada carga ni se choca con los
límites de la cuenta.

### Leads — depende del tipo de anuncio

Acá está la parte que hay que pensar.

**Si el anuncio usa formulario nativo de Meta (Lead Ads):** el lead viene en el
mismo `insights`, dentro de `actions` como `lead`. No hay nada más que hacer.

**Si el anuncio va a WhatsApp (que es nuestro caso):** Meta **no** cuenta eso
como lead. En `insights` figura como clic y nada más. El lead hay que contarlo de
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
- Sin eso, el panel puede mostrar alcance y clics, pero la columna de leads queda
  vacía. No hay manera de sacarla de Meta.

### Resumen de esfuerzo

| Parte | Esfuerzo |
|---|---|
| La pantalla, con los dos filtros | hecho |
| Alcance, inversión, costo por lead | bajo — una llamada a la API + un cron |
| Leads de Lead Ads | bajo — viene en la misma llamada |
| Leads de WhatsApp | medio — guardar el `referral` del primer mensaje y cruzarlo |

Lo bueno: guardar el `referral` es exactamente lo mismo que necesita el agente de
WhatsApp para saber por qué anuncio entró la consulta. Se hace una vez y sirve
para las dos cosas.

Y conviene hacerlo cuanto antes: los leads que entren antes de implementarlo no
se pueden atribuir nunca.

---

## Para pasar a datos reales

Hoy los datos salen de la constante `ANUNCIOS` y se generan de forma determinista
(mismos números en cada carga) para que la demo sea estable.

En producción, reemplazar eso por un `fetch` a un endpoint que devuelva:

```json
{
  "anuncios": [
    {
      "id": "238...401",
      "nombre": "Plan Flex — Río Grande",
      "campania": "TDF-FLEX-NOV",
      "marca": "Volkswagen",
      "estado": "activo",
      "dias": [
        { "fecha": "2026-10-24", "alcance": 1120, "leads": 2, "gasto": 6400 }
      ]
    }
  ]
}
```

El front ya suma por período y por marca solo: alcanza con que cada anuncio traiga
su serie diaria. No hace falta que el backend calcule totales ni variaciones.

`alcance` y `gasto` salen de Meta; `leads` sale del CRM contando por `source_id`.

---

## Paleta

Los colores son variables en `:root` (`--data`, `--surface`, `--ink`…), tomados de
la landing de Plan Car. Si el panel tiene otra identidad, se cambian ahí y la
sección entera se adapta: no hay colores escritos en el medio del código.
