// bcryptjs initializes an asynchronous scheduler even when only sync APIs are
// used. Apps Script has no timers. Async calls deliberately fail; hashSync and
// compareSync never invoke this compatibility binding.
export function setTimeout(){throw new Error('Asynchronous timers are unavailable in Apps Script; use synchronous bcrypt APIs.');}
