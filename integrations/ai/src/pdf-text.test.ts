import { expect, test } from 'bun:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { pdfText } from './pdf-text';

test('reads the lines a PDF draws', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  ['Pay stub — October 2026', 'Employer: Northwind Logistics', 'Gross monthly income: $5,400.00', 'Employee: Jamie Buyer (ID 7731)'].forEach((line, i) => page.drawText(line.replace('—', '-'), { x: 50, y: 780 - i * 20, size: 12, font }));
  const text = pdfText(await doc.save());
  expect(text.split('\n')).toEqual(['Pay stub - October 2026', 'Employer: Northwind Logistics', 'Gross monthly income: $5,400.00', 'Employee: Jamie Buyer (ID 7731)']);
});
