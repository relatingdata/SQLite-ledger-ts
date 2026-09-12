import { Router } from 'express';
import { z } from 'zod';
import { generateInvoicePdf } from '../invoice.js';

export const invoiceRouter = Router();

const invoiceRequestSchema = z.object({
  invoiceReference: z.string().min(1),
  customerName: z.string().min(1),
  date: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
  lineReferences: z.array(z.string().min(1)).min(1),
});

// POST, not GET — this takes a body (the set of posting references
// that make up the invoice), which there's no formal grouping for yet
// at the schema level (see the multi-line invoice work still ahead).
invoiceRouter.post('/pdf', async (req, res) => {
  const parsed = invoiceRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const buffer = await generateInvoicePdf({ ...parsed.data, postedBy: req.user!.username });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${parsed.data.invoiceReference}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: err instanceof Error ? err.message : 'Could not generate this invoice.' });
  }
});
