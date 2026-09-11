'use strict';
// Apps Script has no Node crypto module. bcryptjs uses the explicitly configured
// setRandomFallback adapter in this build. No cryptographic algorithm is replaced.
module.exports={};
