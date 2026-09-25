/**
 * Ledger server entry point.
 *
 * Browser → vanilla JS → Express REST → services → repositories → SQLite.
 * The Express app lives in app.js; this file only binds the port.
 */
import app from "./app.js";
import { config } from "./utils/config.js";

app.listen(config.port, () => {
  console.log(`Ledger running at http://localhost:${config.port} (TZ=${config.timezone})`);
});
