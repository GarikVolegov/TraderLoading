// Test-only alias supplied by run.mjs. Never imported by the production app.
const user = { id: 'audit-local', fullName: 'Audit Locale', firstName: 'Audit', username: 'audit', imageUrl: '', createdAt: new Date('2026-01-01'), primaryEmailAddress: { emailAddress: 'audit@example.test' }, externalAccounts: [] };
const auth = { isLoaded: true, isSignedIn: true, userId: user.id, getToken: async () => 'local-fixture' };
const clerk = { user, session: { id: 'sess_audit', user, getToken: auth.getToken }, addListener: () => () => {}, signOut: async () => {}, openUserProfile: () => {} };
export const ClerkProvider = ({ children }) => { globalThis.Clerk = clerk; return children; };
export const Show = ({ when, children }) => when === 'signed-in' ? children : null;
export const useAuth = () => auth;
export const useClerk = () => clerk;
export const useUser = () => ({ user, isLoaded: true, isSignedIn: true });
export const useSession = () => ({ session: clerk.session, isLoaded: true, isSignedIn: true });
export const SignIn = () => null;
export const SignUp = () => null;
