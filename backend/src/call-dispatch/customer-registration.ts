// Converted from routes/customer-registration.ts. registerCustomer/
// authenticateCustomer are deliberately public (a self-service terminal
// has no staff login) - no requireAuth/requireRole call at all, matching
// the old router's own comment. authenticateCustomer has no live
// frontend caller (confirmed: no reference anywhere in frontend/src) -
// converted anyway for a real, consistent backend surface.
import { registerCustomer, listPendingCustomers, verifyCustomer, authenticateCustomer, asUserId, ValidationError, type CustomerRegistrationInput } from '../db.js';
import { CallError, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

export const customerRegistrationFunctions: Record<string, BackendCall> = {
  // Positional args, in CustomerRegistrationInput's own field order:
  // [0] name, [1] email, [2] phone, [3] address_line1, [4] address_line2,
  // [5] city, [6] region, [7] postal_code, [8] country, [9]
  // preferred_language, [10] password, [11] card_label. Public.
  registerCustomer: (v) => {
    const [name, email, phone, address_line1, address_line2, city, region, postal_code, country, preferred_language, password, card_label] = v;
    if (!name || !email || !password) throw new CallError(400, 'name, email and password are all required.');
    const input: CustomerRegistrationInput = {
      name,
      email,
      phone: phone || null,
      address_line1: address_line1 || null,
      address_line2: address_line2 || null,
      city: city || null,
      region: region || null,
      postal_code: postal_code || null,
      country: country || null,
      preferred_language: preferred_language || null,
      password,
      card_label: card_label || null,
    };
    try {
      registerCustomer(input, asUserId(1)); // registered by the system itself, via the self-service terminal
      return row('pending');
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] name, [1] password. Public.
  authenticateCustomer: (v) => {
    const [name, password] = v;
    if (!name || !password) throw new CallError(400, 'name and password are both required.');
    if (!authenticateCustomer(name, password)) throw new CallError(401, 'Incorrect name or password.');
    return row();
  },
  // No positional args. Staff only.
  listPendingCustomers: (_v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    return table(['name', 'email', 'phone', 'card_label'], listPendingCustomers());
  },
  // Positional args: [0] name, [1] approve ('true'|'false'). Staff only.
  verifyCustomer: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, approveRaw] = v;
    if (!name) throw new CallError(400, 'name is required.');
    try {
      verifyCustomer(name, approveRaw === 'true');
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
