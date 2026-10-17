import pdfmake from 'pdfmake';
import type { TableCell, TDocumentDefinitions } from 'pdfmake/interfaces.js';
import { getInvoiceLine, getContact, getDefaultLanguage, getLocalizedText, asBusinessName, asLedgerName, type InvoiceLine } from './db.js';

pdfmake.setFonts({
  Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' },
});
pdfmake.setUrlAccessPolicy(() => false);
const ALLOWED_FONT_NAMES = new Set(['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique']);
pdfmake.setLocalAccessPolicy((path: string) => ALLOWED_FONT_NAMES.has(path));

export interface InvoiceOptions {
  invoiceReference: string; // the display reference for the whole document
  customerName: string;
  date: string;
  postedBy: string;
  lineReferences: string[]; // the underlying posting references that make up this invoice
  business: string;
  ledger: string;
}

const money = (minorUnits: number) => (minorUnits / 100).toFixed(2);

/** Builds a real invoice PDF from actually-posted lines. Tax is read
 * per line from invoice_line, never assumed uniform — one line can be
 * fully exempt while another is taxed at a completely different rate,
 * and the total simply sums whatever each line actually posted, which
 * is correct regardless of how many different rates were involved.
 *
 * Language: this specific customer's own preferred_language takes
 * priority (genuinely necessary in multilingual markets like Canada
 * and Switzerland, where the business's own default language says
 * nothing about what a specific customer wants their invoice in),
 * falling back to the business's own default language, then English. */
export async function generateInvoicePdf(options: InvoiceOptions): Promise<Buffer> {
  const lines: InvoiceLine[] = [];
  for (const ref of options.lineReferences) {
    const line = getInvoiceLine(ref, asBusinessName(options.business), asLedgerName(options.ledger));
    if (!line) throw new Error(`No invoice line recorded for reference "${ref}" — was it actually posted through AR Sale, AP Purchase, Stock Receipt, or Stock Dispatch?`);
    lines.push(line);
  }

  const contact = getContact(options.customerName);
  const language = contact?.preferred_language ?? getDefaultLanguage() ?? 'English';
  const t = language === 'English' ? {} : getLocalizedText(language);
  const tr = (word: string) => t[word] ?? word;

  const subtotalMinor = lines.reduce((s, l) => s + l.amount_minor, 0);
  const taxMinor = lines.reduce((s, l) => s + l.tax_minor, 0);
  const grandTotalMinor = subtotalMinor + taxMinor;

  const tableRows: TableCell[][] = [
    [
      { text: tr('Description'), bold: true },
      { text: tr('Qty'), bold: true, alignment: 'right' },
      { text: tr('Unit Price'), bold: true, alignment: 'right' },
      { text: tr('Amount'), bold: true, alignment: 'right' },
      { text: tr('Tax'), bold: true, alignment: 'right' },
    ],
  ];
  for (const line of lines) {
    tableRows.push([
      line.description,
      { text: line.quantity != null ? String(line.quantity) : '—', alignment: 'right' },
      { text: line.unit_price_minor != null ? money(line.unit_price_minor) : '—', alignment: 'right' },
      { text: money(line.amount_minor), alignment: 'right' },
      { text: money(line.tax_minor), alignment: 'right' },
    ]);
  }

  const contactLines = contact
    ? [
        contact.address_line1,
        contact.address_line2,
        `${contact.city ?? ''}${contact.city && contact.region ? ', ' : ''}${contact.region ?? ''} ${contact.postal_code ?? ''}`.trim(),
        contact.country,
      ].filter((l): l is string => Boolean(l && l.trim()))
    : [];

  const docDefinition: TDocumentDefinitions = {
    defaultStyle: { font: 'Helvetica', fontSize: 10 },
    pageMargins: [40, 60, 40, 50] as [number, number, number, number], // extra top/bottom room for header/footer
    header: (currentPage: number, pageCount: number) => ({
      text: `${options.business} — ${tr('Invoice')} ${options.invoiceReference}${pageCount > 1 ? ` (${tr('Page')} ${currentPage}/${pageCount})` : ''}`,
      alignment: 'right' as const,
      fontSize: 8,
      color: '#666666',
      margin: [40, 20, 40, 0] as [number, number, number, number],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      text: `${tr('Page')} ${currentPage}/${pageCount}`,
      alignment: 'center' as const,
      fontSize: 8,
      color: '#666666',
      margin: [40, 0, 40, 20] as [number, number, number, number],
    }),
    content: [
      { text: tr('Invoice').toUpperCase(), style: 'header' },
      { text: `${tr('Reference')}: ${options.invoiceReference}`, margin: [0, 4, 0, 0] as [number, number, number, number] },
      { text: `${tr('Date')}: ${options.date}` },
      { text: `${tr('Posted by')}: ${options.postedBy}`, margin: [0, 0, 0, 12] as [number, number, number, number] },
      { text: `${tr('Bill to')}:`, bold: true },
      { text: options.customerName },
      ...contactLines.map((l) => ({ text: l })),
      { text: '', margin: [0, 0, 0, 16] as [number, number, number, number] },
      { table: { widths: ['*', 'auto', 'auto', 'auto', 'auto'], body: tableRows }, layout: 'lightHorizontalLines' },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [tr('Subtotal'), { text: money(subtotalMinor), alignment: 'right' }],
            [tr('Tax'), { text: money(taxMinor), alignment: 'right' }],
            [{ text: tr('Total due'), bold: true }, { text: money(grandTotalMinor), bold: true, alignment: 'right' }],
          ],
        },
        layout: 'noBorders',
        margin: [0, 8, 0, 0] as [number, number, number, number],
      },
    ],
    styles: { header: { fontSize: 18, bold: true } },
  };

  const doc = pdfmake.createPdf(docDefinition);
  return doc.getBuffer();
}
