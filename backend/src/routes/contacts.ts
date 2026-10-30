import { Router } from 'express';
import { requireRole } from '../auth-middleware.js';
import { z } from 'zod';
import { getContact, setContact, addTypedAddress, getTypedAddresses, deleteTypedAddress, listAddressTypes, addTypedPhone, getTypedPhones, deleteTypedPhone, listPhoneTypes, addTypedContactPerson, getTypedContactPersons, deleteTypedContactPerson, listContactPersonTypes, getCreditStatus,
  asUserId,
} from '../db.js';

export const contactsRouter = Router();

// Real, static paths — must come before the dynamic /:name route
// below, or Express would match them as if each were itself a real
// entity name.
contactsRouter.get('/contact-person-types', (_req, res) => {
  res.json(listContactPersonTypes());
});

contactsRouter.get('/address-types', (_req, res) => {
  res.json(listAddressTypes());
});

contactsRouter.get('/phone-types', (_req, res) => {
  res.json(listPhoneTypes());
});

contactsRouter.get('/:name', (req, res) => {
  const contact = getContact(req.params.name);
  res.json(contact ?? null);
});

contactsRouter.get('/:name/credit-status', (req, res) => {
  res.json(getCreditStatus(req.params.name));
});

const contactSchema = z.object({
  business_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  payment_terms_days: z.number().int().nonnegative().nullable().optional(),
  credit_limit_minor: z.number().int().nonnegative().nullable().optional(),
  wage_minor_per_hour: z.number().int().nonnegative().nullable().optional(),
  salary_minor_per_year: z.number().int().nonnegative().nullable().optional(),
  preferred_language: z.string().nullable().optional(),
});

contactsRouter.put('/:name', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setContact(req.params.name, parsed.data);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save contact.' });
  }
});

// Typed addresses — an entity can have several (Registered Office AND
// Billing AND Delivery, genuinely different), which a single contact
// record can't express. See docs/entity-model.md.
contactsRouter.get('/:name/addresses', (req, res) => {
  res.json(getTypedAddresses(req.params.name));
});

const typedAddressSchema = z.object({
  address_type: z.string().min(1),
  business_name: z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

contactsRouter.put('/:name/addresses', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = typedAddressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const { address_type, ...value } = parsed.data;
    addTypedAddress(req.params.name, address_type, value, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save address.' });
  }
});

contactsRouter.delete('/:name/addresses/:addressType', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    deleteTypedAddress(req.params.name, req.params.addressType, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete address.' });
  }
});

// Typed phones — same pattern, for Landline/Mobile/Home/Fax/Toll-Free.
contactsRouter.get('/:name/phones', (req, res) => {
  res.json(getTypedPhones(req.params.name));
});

const typedPhoneSchema = z.object({
  phone_type: z.string().min(1),
  phone: z.string().min(1),
  business_name: z.string().nullish(),
});

contactsRouter.put('/:name/phones', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = typedPhoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    addTypedPhone(req.params.name, parsed.data.phone_type, parsed.data.phone, asUserId(req.user!.id), parsed.data.business_name);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save phone.' });
  }
});

contactsRouter.delete('/:name/phones/:phoneType', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    deleteTypedPhone(req.params.name, req.params.phoneType, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete phone.' });
  }
});

// Real, named contact persons — attachable to any real entity at all
// (creditor, debtor, employee, location, ...), under a real, direct,
// genuinely user-definable role (Credit Manager, Sales Clerk,
// Dispatch, Store Man, Emergency Contact, or a real, new one typed in
// on the spot). See docs/entity-model.md.
contactsRouter.get('/:name/contact-persons', (req, res) => {
  res.json(getTypedContactPersons(req.params.name));
});

const typedContactPersonSchema = z.object({
  contact_type: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

contactsRouter.put('/:name/contact-persons', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = typedContactPersonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const { contact_type, ...value } = parsed.data;
    addTypedContactPerson(req.params.name, contact_type, value, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save contact person.' });
  }
});

contactsRouter.delete('/:name/contact-persons/:contactType', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    deleteTypedContactPerson(req.params.name, req.params.contactType, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete contact person.' });
  }
});
