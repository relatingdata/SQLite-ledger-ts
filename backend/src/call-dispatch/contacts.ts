// Converted from routes/contacts.ts. The whole router was mounted behind
// a blanket requireAuth in server.ts; mutating endpoints further require
// Administrator or Bookkeeper, replicated per-function here.
import {
  getContact,
  setContact,
  addTypedAddress,
  getTypedAddresses,
  deleteTypedAddress,
  listAddressTypes,
  addTypedPhone,
  getTypedPhones,
  deleteTypedPhone,
  listPhoneTypes,
  addTypedContactPerson,
  getTypedContactPersons,
  deleteTypedContactPerson,
  listContactPersonTypes,
  getCreditStatus,
  asUserId,
} from '../db.js';
import { CallError, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

// Matches the old route's own contactSchema exactly — a settable subset
// of the real Contact interface (no person_name/reminder_level/
// verification_status/card_label/pos_pin, which the old route never let
// this endpoint touch either).
const CONTACT_FIELDS = [
  'business_name', 'phone', 'email', 'address_line1', 'address_line2', 'city', 'region', 'postal_code', 'country',
  'payment_terms_days', 'credit_limit_minor', 'wage_minor_per_hour', 'salary_minor_per_year', 'preferred_language',
] as const;
const NUMERIC_CONTACT_FIELDS = new Set(['payment_terms_days', 'credit_limit_minor', 'wage_minor_per_hour', 'salary_minor_per_year']);

export const contactsFunctions: Record<string, BackendCall> = {
  // No args.
  listContactPersonTypes: (v, user) => {
    requireAuth(user);
    return table(['name'], listContactPersonTypes().map((name) => ({ name })));
  },
  // No args.
  listAddressTypes: (v, user) => {
    requireAuth(user);
    return table(['name'], listAddressTypes().map((name) => ({ name })));
  },
  // No args.
  listPhoneTypes: (v, user) => {
    requireAuth(user);
    return table(['name'], listPhoneTypes().map((name) => ({ name })));
  },
  // Positional args: [0] name. An explicit exists flag in field 0 — the
  // real result can be undefined — since CSV has no native null, same
  // technique as items.ts's getItem.
  getContact: (v, user) => {
    requireAuth(user);
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    const contact = getContact(name);
    if (!contact) return row('0');
    return row(
      '1',
      contact.business_name,
      contact.phone,
      contact.email,
      contact.address_line1,
      contact.address_line2,
      contact.city,
      contact.region,
      contact.postal_code,
      contact.country,
      contact.payment_terms_days,
      contact.credit_limit_minor,
      contact.wage_minor_per_hour,
      contact.salary_minor_per_year,
      contact.reminder_level,
      contact.preferred_language
    );
  },
  // Positional args: [0] name, [1..14] the 14 CONTACT_FIELDS in order
  // (business_name through preferred_language). setContact always fully
  // replaces the whole record (every unspecified field becomes null) —
  // confirmed by reading db.ts's own setContact body directly — so no
  // undefined/null distinction is needed on the wire, unlike a true
  // partial-merge endpoint.
  setContact: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, ...fields] = v;
    if (!name) throw new CallError(400, 'name is required.');
    const contact: Record<string, string | number | null> = {};
    CONTACT_FIELDS.forEach((field, i) => {
      const raw = fields[i];
      contact[field] = !raw ? null : NUMERIC_CONTACT_FIELDS.has(field) ? Number(raw) : raw;
    });
    try {
      setContact(name, contact);
      return row();
    } catch (err) {
      console.error(err);
      throw new CallError(500, 'Could not save contact.');
    }
  },
  // Positional args: [0] name.
  getCreditStatus: (v, user) => {
    requireAuth(user);
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    const status = getCreditStatus(name);
    return row(status.balanceMinor, status.limitMinor, status.overLimit, status.remainingMinor);
  },
  // Positional args: [0] name.
  getTypedAddresses: (v, user) => {
    requireAuth(user);
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    return table(
      ['address_type', 'record_name', 'business_name', 'address_line1', 'address_line2', 'city', 'region', 'postal_code', 'country'],
      getTypedAddresses(name)
    );
  },
  // Positional args: [0] name, [1] address_type, [2] business_name,
  // [3] address_line1, [4] address_line2, [5] city, [6] region,
  // [7] postal_code, [8] country.
  setTypedAddress: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, addressType, businessName, addressLine1, addressLine2, city, region, postalCode, country] = v;
    if (!name || !addressType) throw new CallError(400, 'name and address_type are both required.');
    try {
      addTypedAddress(
        name,
        addressType,
        { business_name: businessName || null, address_line1: addressLine1 || null, address_line2: addressLine2 || null, city: city || null, region: region || null, postal_code: postalCode || null, country: country || null },
        asUserId(admin.id)
      );
      return row();
    } catch (err) {
      console.error(err);
      throw new CallError(500, 'Could not save address.');
    }
  },
  // Positional args: [0] name, [1] addressType.
  deleteTypedAddress: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, addressType] = v;
    if (!name || !addressType) throw new CallError(400, 'name and addressType are both required.');
    try {
      deleteTypedAddress(name, addressType, asUserId(admin.id));
      return row();
    } catch (err) {
      console.error(err);
      throw new CallError(500, 'Could not delete address.');
    }
  },
  // Positional args: [0] name.
  getTypedPhones: (v, user) => {
    requireAuth(user);
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    return table(['phone_type', 'record_name', 'phone', 'business_name'], getTypedPhones(name));
  },
  // Positional args: [0] name, [1] phone_type, [2] phone,
  // [3] business_name (optional).
  setTypedPhone: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, phoneType, phone, businessName] = v;
    if (!name || !phoneType || !phone) throw new CallError(400, 'name, phone_type and phone are all required.');
    try {
      addTypedPhone(name, phoneType, phone, asUserId(admin.id), businessName || null);
      return row();
    } catch (err) {
      console.error(err);
      throw new CallError(500, 'Could not save phone.');
    }
  },
  // Positional args: [0] name, [1] phoneType.
  deleteTypedPhone: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, phoneType] = v;
    if (!name || !phoneType) throw new CallError(400, 'name and phoneType are both required.');
    try {
      deleteTypedPhone(name, phoneType, asUserId(admin.id));
      return row();
    } catch (err) {
      console.error(err);
      throw new CallError(500, 'Could not delete phone.');
    }
  },
  // Positional args: [0] name.
  getTypedContactPersons: (v, user) => {
    requireAuth(user);
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    return table(['contact_type', 'record_name', 'name', 'phone', 'email'], getTypedContactPersons(name));
  },
  // Positional args: [0] name, [1] contact_type, [2] personName,
  // [3] phone (optional), [4] email (optional).
  setTypedContactPerson: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, contactType, personName, phone, email] = v;
    if (!name || !contactType || !personName) throw new CallError(400, 'name, contact_type and name (of the person) are all required.');
    try {
      addTypedContactPerson(name, contactType, { name: personName, phone: phone || null, email: email || null }, asUserId(admin.id));
      return row();
    } catch (err) {
      console.error(err);
      throw new CallError(500, 'Could not save contact person.');
    }
  },
  // Positional args: [0] name, [1] contactType.
  deleteTypedContactPerson: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, contactType] = v;
    if (!name || !contactType) throw new CallError(400, 'name and contactType are both required.');
    try {
      deleteTypedContactPerson(name, contactType, asUserId(admin.id));
      return row();
    } catch (err) {
      console.error(err);
      throw new CallError(500, 'Could not delete contact person.');
    }
  },
};
