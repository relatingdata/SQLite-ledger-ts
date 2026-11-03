// Converted from routes/products.ts. No live frontend caller exists yet
// for any of these three (all commented out in api.ts, pre-existing,
// unrelated to this conversion) - converted anyway for a real,
// consistent backend surface; api.ts stays untouched until a real
// caller needs one revived.
import { listProducts, createProduct, setItemProduct, ValidationError, NotFoundError, asUserId } from '../db.js';
import { CallError, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

export const productsFunctions: Record<string, BackendCall> = {
  listProducts: () => table(['name', 'itemCount'], listProducts()),
  // Positional args: [0] name, [1] parent ('' defaults to 'Items').
  createProduct: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, parentRaw] = v;
    if (!name) throw new CallError(400, 'name is required.');
    try {
      createProduct(name, parentRaw || 'Items', asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] itemName, [1] productName ('' = null).
  setItemProduct: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [itemName, productNameRaw] = v;
    if (!itemName) throw new CallError(400, 'itemName is required.');
    try {
      setItemProduct(itemName, productNameRaw || null, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
