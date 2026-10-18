// Test-only alias. Production never imports this module.
export * from '../verify-operating-center/clerk-fixture.js';
export const useSession = () => ({ isLoaded: true, session: null });
