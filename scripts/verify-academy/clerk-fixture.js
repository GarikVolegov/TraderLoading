// Test-only alias. Production does not import this file or use these identities.
const actor = (typeof localStorage !== "undefined" ? localStorage.getItem("academy_fixture_actor") : null) ?? "student";
const signedIn = actor !== "visitor";
const user = signedIn ? { id: `academy-${actor}`, fullName: "Academy Audit", firstName: "Academy", username: "academy-audit", imageUrl: "", createdAt: new Date("2026-01-01"), primaryEmailAddress: { emailAddress: "academy@example.test" }, externalAccounts: [] } : null;
const auth = { isLoaded: true, isSignedIn: signedIn, userId: user?.id ?? null, getToken: async () => "isolated-academy-fixture" };
const clerk = { user, session: signedIn ? { id: `session-${actor}`, user, getToken: auth.getToken } : null, addListener: () => () => {}, signOut: async () => {}, openUserProfile: () => {} };
export const ClerkProvider = ({ children }) => { globalThis.Clerk = clerk; return children; };
export const Show = ({ when, children }) => when === (signedIn ? "signed-in" : "signed-out") ? children : null;
export const useAuth = () => auth;
export const useClerk = () => clerk;
export const useUser = () => ({ user, isLoaded: true, isSignedIn: signedIn });
export const useSession = () => ({ isLoaded: true, session: clerk.session });
export const SignIn = () => null;
export const SignUp = () => null;
