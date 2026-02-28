const { onRequest } = require("firebase-functions/v2/https");
const app = require("../server");

// Expose the Express app as a Firebase Cloud Function named 'api'
exports.api = onRequest({ timeoutSeconds: 300, memory: "1GiB" }, app);
