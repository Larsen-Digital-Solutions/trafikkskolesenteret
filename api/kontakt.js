// Kontaktskjemaet på trafikkskolesenteret.com: sender henvendelsen til læreren eleven
// valgte, via Resend, fra skolens eget domene.
//
// Erstatter FormSubmit (okt. 2026). Der måtte hver mottaker aktivere adressen sin via
// en e-post, og en eldre aktiveringslenke sluttet å virke når skjemaet ble sendt på
// nytt. Meldinger til en uaktivert adresse forsvant, og eleven fikk bare en feilmelding.
//
// Mottakerne står her, ikke i skjemaet: nettleseren sender bare NAVNET på læreren, så
// ingen kan bruke funksjonen til å sende e-post til andre adresser.

const MOTTAKERE = {
  'Stein Jarle Rønningen': 'steinjronningen@gmail.com',
  'Chris Ove Rønningen': 'chrisoveronningen@gmail.com',
};
const STANDARD = 'Stein Jarle Rønningen';
const FRA = 'Trafikkskolesenteret <nettside@trafikkskolesenteret.com>';
const TILLATT_OPPRINNELSE = /^https:\/\/(www\.)?trafikkskolesenteret\.(com|net)$/;

const rens = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function lesKropp(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = Object.fromEntries(new URLSearchParams(b)); }
  }
  return b && typeof b === 'object' ? b : {};
}

function epostHtml({ navn, tlf, epost, klasse, melding, mottaker }) {
  const rad = (etikett, verdi) =>
    `<tr><td style="padding:8px 16px 8px 0;color:#5b6670;font-size:14px;white-space:nowrap;vertical-align:top">${etikett}</td>` +
    `<td style="padding:8px 0;color:#0c1e2a;font-size:15px;font-weight:600">${verdi}</td></tr>`;
  const tlfLenke = `<a href="tel:${esc(tlf.replace(/[^\d+]/g, ''))}" style="color:#c4262c;text-decoration:none">${esc(tlf)}</a>`;
  const epostLenke = epost ? `<a href="mailto:${esc(epost)}" style="color:#c4262c;text-decoration:none">${esc(epost)}</a>` : '–';
  return `<!doctype html><html lang="no"><body style="margin:0;background:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e7eb">
<tr><td style="background:#0c1e2a;padding:20px 24px">
  <div style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.2px">Trafikkskolesenteret</div>
  <div style="color:#aeb9c2;font-size:13px;margin-top:2px">Ny henvendelse fra nettsiden</div>
</td></tr>
<tr><td style="padding:24px">
  <p style="margin:0 0 16px;color:#0c1e2a;font-size:16px"><strong>${esc(navn)}</strong> har sendt en melding via kontaktskjemaet${klasse ? ` om <strong>${esc(klasse)}</strong>` : ''}.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px">
    ${rad('Navn', esc(navn))}${rad('Telefon', tlfLenke)}${rad('E-post', epostLenke)}${rad('Ønsker', klasse ? esc(klasse) : '–')}${rad('Sendt til', esc(mottaker))}
  </table>
  ${melding ? `<div style="background:#f4f6f8;border-radius:10px;padding:14px 16px;color:#0c1e2a;font-size:15px;line-height:1.5;white-space:pre-wrap">${esc(melding)}</div>` : '<p style="color:#5b6670;font-size:14px;margin:0">Ingen melding skrevet.</p>'}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e3e7eb;color:#5b6670;font-size:12.5px;line-height:1.5">
  ${epost ? `Svar på denne e-posten for å svare ${esc(navn)} direkte, eller ring ${esc(tlf)}.` : `Eleven oppga ikke e-post. Ring ${esc(tlf)} for å svare.`}<br>
  Sendt fra kontaktskjemaet på www.trafikkskolesenteret.com
</td></tr>
</table></td></tr></table></body></html>`;
}

function epostTekst({ navn, tlf, epost, klasse, melding, mottaker }) {
  return [
    'Trafikkskolesenteret – ny henvendelse fra nettsiden', '',
    `Navn: ${navn}`, `Telefon: ${tlf}`, `E-post: ${epost || '–'}`, `Ønsker: ${klasse || '–'}`, `Sendt til: ${mottaker}`, '',
    melding || '(Ingen melding skrevet.)', '',
    epost ? `Svar på denne e-posten for å svare ${navn} direkte.` : `Eleven oppga ikke e-post. Ring ${tlf}.`,
    'Sendt fra kontaktskjemaet på www.trafikkskolesenteret.com',
  ].join('\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const opprinnelse = req.headers.origin || '';
  if (opprinnelse && !TILLATT_OPPRINNELSE.test(opprinnelse)) return res.status(403).json({ ok: false });

  const b = lesKropp(req);
  // Honningfella: et felt mennesker ikke ser. Svar «sendt», men send ingenting.
  if (rens(b._honey, 200)) return res.status(200).json({ ok: true });

  const mottaker = Object.prototype.hasOwnProperty.call(MOTTAKERE, b.mottaker) ? b.mottaker : STANDARD;
  const felt = {
    navn: rens(b.navn, 120),
    tlf: rens(b.tlf, 40),
    epost: rens(b.epost, 160),
    klasse: rens(b.klasse, 80),
    melding: String(b.melding ?? '').replace(/\r\n/g, '\n').trim().slice(0, 4000),
    mottaker,
  };
  if (!felt.navn || !felt.tlf) return res.status(400).json({ ok: false, feil: 'Navn og telefon må fylles ut.' });
  const gyldigEpost = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(felt.epost);
  if (!gyldigEpost) felt.epost = '';

  const svar = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FRA,
      to: [MOTTAKERE[mottaker]],
      ...(felt.epost ? { reply_to: felt.epost } : {}),
      subject: `Ny henvendelse fra nettsiden: ${felt.navn}${felt.klasse ? ` – ${felt.klasse}` : ''}`,
      html: epostHtml(felt),
      text: epostTekst(felt),
    }),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));

  if (!svar.ok) {
    console.error('kontaktskjema: Resend svarte', svar.status, (await svar.text()).slice(0, 300));
    return res.status(502).json({ ok: false });
  }

  // Uten JavaScript poster nettleseren skjemaet rett hit: send eleven tilbake til siden.
  const vilHtml = !String(req.headers['content-type'] || '').includes('json') && String(req.headers.accept || '').includes('text/html');
  if (vilHtml) {
    res.statusCode = 303;
    res.setHeader('Location', '/kontakt.html?sendt=1');
    return res.end();
  }
  return res.status(200).json({ ok: true });
};
