/* Genera el PDF de aprobación: captura la sección y arma el documento.
 *
 *   npm install playwright
 *   node generar.js
 *
 * Deja Campanias-Meta-PlanCar-aprobacion.pdf en la carpeta de arriba.
 * Volver a correrlo después de actualizar datos.js refresca las capturas. */
const { chromium } = require('playwright');
const path = require('path');

const AQUI = __dirname;
const PANEL = 'file://' + path.resolve(AQUI, '..', 'index.html');
const SALIDA = path.resolve(AQUI, '..', 'Campanias-Meta-PlanCar-aprobacion.pdf');

/* En el contenedor de Claude Code el navegador está acá; en otra máquina,
   borrar executablePath y dejar que Playwright use el suyo. */
const LANZAR = { args: ['--no-sandbox'] };
if (require('fs').existsSync('/opt/pw-browsers/chromium')) {
  LANZAR.executablePath = '/opt/pw-browsers/chromium';
}

(async () => {
  const b = await chromium.launch(LANZAR);

  /* ── 1. Capturas de la sección ── */
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 });
  await p.goto(PANEL);
  await p.waitForTimeout(900);

  await p.click('[data-range="30"]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(AQUI, 'cap-general.png'), fullPage: true });
  await p.locator('.kpis').screenshot({ path: path.join(AQUI, 'cap-kpis.png') });

  await p.click('[data-marca="Chevrolet"]');
  await p.waitForTimeout(700);
  /* Junta barra de filtros + KPIs + gráfico en un bloque para recortarlo */
  await p.evaluate(() => {
    const caja = document.createElement('div');
    caja.id = 'recorte';
    const f = document.querySelector('.filterbar');
    f.parentNode.insertBefore(caja, f);
    caja.appendChild(f);
    caja.appendChild(document.querySelector('.kpis'));
    caja.appendChild(document.querySelector('.grid-2 .card'));
  });
  await p.waitForTimeout(500);
  await p.locator('#recorte').screenshot({ path: path.join(AQUI, 'cap-marca.png') });
  await p.close();

  /* ── 2. El PDF ── */
  const d = await b.newPage();
  await d.goto('file://' + path.join(AQUI, 'informe.html'), { waitUntil: 'networkidle' });
  await d.waitForTimeout(1200);
  await d.pdf({
    path: SALIDA, format: 'A4', printBackground: true,
    margin: { top: '16mm', right: '15mm', bottom: '14mm', left: '15mm' }
  });

  await b.close();
  console.log('PDF generado en', SALIDA);
})();
