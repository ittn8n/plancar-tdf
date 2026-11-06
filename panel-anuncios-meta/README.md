# Campañas — Anuncios de Meta

Sección para el panel de Plan Car, en **Reportes comerciales → Campañas**.

Muestra, por campaña: **estado, impresiones, leads y costo por lead**, con
**filtro de marca** y **filtro de período**.

**Los datos son reales**, no de muestra: salen de `public."PlanCar_MetaMetrics"`
en el Supabase de Integraltek. El archivo `datos.js` es un snapshot del 6/11/2026
con los últimos 60 días.

```
reportes-campanias/
├── index.html   ← la página
└── datos.js     ← el snapshot (se reemplaza por el endpoint en vivo)
```

HTML suelto, sin dependencias ni build. No pisa nada del panel: se copia en una
carpeta nueva y se le agrega un link al menú.

---

## Instalación en cPanel

1. **cPanel → Administrador de archivos**
2. Ir a la carpeta del panel (`public_html/` o la del subdominio)
3. **Subir** `plancar-campanias.zip`
4. Clic derecho → **Extract**
5. Borrar el `.zip` del servidor

Queda `reportes-campanias/` como carpeta nueva. El zip trae **una sola carpeta y
nada en la raíz**, así que no toca ningún archivo existente.

Verificar en `https://tudominio.com/reportes-campanias/`

### El único cambio manual: el link en el menú

```html
<a href="/reportes-campanias/">Campañas</a>
```

Dentro de Reportes comerciales. Si el menú se arma por PHP o desde una tabla,
agregar la entrada donde corresponda. Es una línea.

---

## ⚠️ Dos cosas que conviene arreglar antes de mostrárselo al cliente

### 1. No hay alcance — la base guarda impresiones

Agustín pidió **alcance**, pero `PlanCar_MetaMetrics` no tiene esa columna.
Tiene `impresiones`, que es otra cosa:

- **Alcance** = personas únicas que vieron el anuncio
- **Impresiones** = cuántas veces se mostró (la misma persona cuenta varias)

Con 1.291.648 impresiones en 30 días, el alcance real es bastante menor. Mostrar
impresiones diciendo "alcance" sería un número inflado.

Por eso el panel dice **Impresiones**, con un aviso al lado.

**Cómo se arregla:** `reach` es un campo más en la misma llamada a la API de Meta
que ya se está haciendo. Hay que:

1. Agregarlo a los `fields` del sync (workflow `PlanCar Meta Sync`).
2. Agregar la columna: `alter table public."PlanCar_MetaMetrics" add column alcance bigint;`
3. Cambiar `impresiones` por `alcance` en el panel.

Ojo: el alcance **no es sumable entre días**. Si alguien ve el anuncio el lunes y
el martes, es 1 persona alcanzada, no 2. Para el alcance de un período hay que
pedírselo a Meta con ese rango de fechas, no sumar los diarios. Por eso conviene
guardar también el alcance mensual aparte.

### 2. Una campaña está mal clasificada

La campaña **`Paugeot_Test_Drive_Form`** figura con marca **Citroën**. Es de
Peugeot: el nombre tiene un error de tipeo ("Paugeot") y el mapeo de marca no lo
reconoce, así que cae en otra.

Son 4 días y $11.088, poca plata, pero ensucia el filtro por marca.

Se arregla en el origen (corregir el nombre en Meta o agregar el alias al mapeo
del sync). Mientras tanto, el panel lo muestra tal como está en la base: preferí
no maquillarlo acá para que se vea el problema real.

---

## Qué significa cada número

| En el panel | De dónde sale |
|---|---|
| Impresiones | `impresiones` |
| Leads | `contactos + leads_form` |
| Costo por lead | `gasto / leads` |
| Inversión | `gasto` |
| Estado | Activa si tuvo gasto en el período; si no, Sin actividad |

**`contactos`** son las conversaciones de WhatsApp iniciadas desde el anuncio, y
**`leads_form`** los formularios nativos de Meta completados. Las dos cosas ya
las reporta Meta y ya las trae el sync: no hubo que construir nada.

Lo que **no** está resuelto es atar cada uno de esos contactos a un lead concreto
del CRM. Para eso hace falta guardar el `referral` que llega con el primer mensaje
de WhatsApp. Es lo que permitiría seguir el embudo completo —anuncio → lead →
venta— en vez de quedarse en el conteo. Es el mismo dato que necesita el agente
de WhatsApp, así que se hace una vez y sirve para las dos cosas.

---

## Filtros

**Marca.** Se arma solo a partir de las marcas presentes en los datos: Chevrolet,
Citroën, Peugeot y Volkswagen. (En `plancar.marcas` hay una quinta, *Usados*,
pero no tiene campañas en Meta.) Afecta a todo a la vez: los cuatro números, la
curva y la tabla.

**Período.** 7, 14 o 30 días. Los porcentajes comparan contra el período
inmediatamente anterior del mismo largo.

---

## Pasar a datos en vivo

Hoy `datos.js` define `window.META_DATOS` con esta forma:

```js
window.META_DATOS = {
  generado: '2026-11-06',
  campanias: [[0, 'Chevrolet - Clientes Potenciales  28/9', 'Chevrolet'], ...],
  filas: [[0, '2026-11-06', 26442, 6868, 50, 2, 0], ...]
  //      [campania_idx, fecha, gasto, impresiones, clicks, contactos, leads_form]
};
```

Para ponerlo en vivo, reemplazar el `<script src="datos.js">` por un `fetch` a un
endpoint que devuelva lo mismo. La query que genera ese JSON:

```sql
with camp as (
  select distinct campania, marca
  from public."PlanCar_MetaMetrics"
  where fecha >= current_date - 59 and coalesce(excluida, false) = false
),
idx as (
  select campania, marca, row_number() over (order by marca, campania) - 1 as ci
  from camp
)
select json_build_object(
  'generado', current_date::text,
  'campanias', (select json_agg(json_build_array(ci, campania, marca) order by ci) from idx),
  'filas', (
    select json_agg(json_build_array(i.ci, m.fecha::text, round(m.gasto)::int,
                                     m.impresiones, m.clicks, m.contactos, m.leads_form)
                    order by m.fecha, i.ci)
    from public."PlanCar_MetaMetrics" m
    join idx i on i.campania = m.campania
    where m.fecha >= current_date - 59 and coalesce(m.excluida, false) = false
  )
);
```

El front suma por período y por marca solo. El backend no tiene que calcular
totales ni variaciones: le alcanza con mandar la serie diaria.

Nota: en el snapshot el gasto está redondeado por fila, así que los totales
pueden diferir en 2 o 3 pesos contra la base. En vivo, sacando el `round()`,
coincide exacto.

---

## Verificación

Los totales del panel se contrastaron contra la base para el período
8/10 al 6/11:

| Marca | Impresiones | Leads |
|---|---|---|
| Chevrolet | 382.601 | 149 |
| Citroën | 277.126 | 100 |
| Peugeot | 310.321 | 104 |
| Volkswagen | 321.600 | 112 |
| **Total** | **1.291.648** | **465** |

Coinciden exacto con lo que muestra la pantalla.

---

## Paleta

Los colores son variables en `:root` (`--data`, `--surface`, `--ink`…). Si el
panel tiene otra identidad, se cambian ahí.

En `plancar.marcas` cada marca tiene su `color_primario`, pero no sirven como
colores de gráfico sobre fondo oscuro: Peugeot (`#00205B`) y Volkswagen
(`#001E50`) son azules casi negros, indistinguibles entre sí y sin contraste
contra el fondo. Por eso los datos van en un solo azul y la marca se identifica
por texto. Los colores de marca sí sirven para logos y encabezados.
