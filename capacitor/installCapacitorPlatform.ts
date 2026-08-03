import { setPlatform } from '@/platform';
import { createCapacitorPlatform } from '@/platform/capacitorPlatform';

// Side-effect module, deliberately — see dev/installWebPlatform.ts for the
// reasoning. A bare setPlatform() statement in main.capacitor.ts would run
// after every import in that file had been evaluated, because import
// declarations hoist.
//
// This must be the FIRST import in the entry: fetchWithAuth reads
// getPlatform().kind to choose its transport, and getting "extension" here
// (there is no chrome runtime, so it would throw instead) is not recoverable.
setPlatform(createCapacitorPlatform());
