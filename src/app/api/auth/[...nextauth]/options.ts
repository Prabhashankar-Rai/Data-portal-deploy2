import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { getDb } from "@/lib/json-db";

export const authOptions: NextAuthOptions = {
    providers: [
        AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID || "MISSING",
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "MISSING",
            tenantId: "common",
            authorization: {
                params: {
                    prompt: "select_account",
                },
            },
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            console.log("\n--- [NEXTAUTH] signIn callback triggered ---");
            console.log("User:", JSON.stringify(user));
            console.log("Profile:", JSON.stringify(profile));
            const email = (user.email || (profile as any)?.preferred_username || (profile as any)?.upn || "").toLowerCase().trim();
            console.log("Determined Email:", email);

            if (!email) {
                console.error("No email provided by Azure AD profile.", profile);
                return false;
            }

            if (email === "prabhashankar.rai@fairfaxasia.com") {
                return true;
            }

            const db = getDb();
            const dbUser = db.Users.find((u: any) =>
                u.email?.toLowerCase().trim() === email ||
                u.username?.toLowerCase().trim() === email
            );

            if (!dbUser) {
                console.warn(`Unauthorized login attempt from ${email}. Not found in local DB.`);
                return false; 
            }

            return true; 
        },
        async jwt({ token, user, profile }) {
            if (user || profile) {
                const email = (token.email || user?.email || (profile as any)?.preferred_username || "").toLowerCase().trim();
                token.email = email;

                if (email === "prabhashankar.rai@fairfaxasia.com") {
                    token.role = "ADMIN";
                    token.user_id = "prabhashankar.rai";
                    token.username = "Prabhashankar Rai";
                    console.log("JWT: Matched admin bypass for:", email);
                } else {
                    const db = getDb();
                    const dbUser = db.Users.find((u: any) =>
                        u.email?.toLowerCase().trim() === email ||
                        u.username?.toLowerCase().trim() === email
                    );

                    if (dbUser) {
                        token.role = dbUser.role || "USER"; 
                        token.user_id = dbUser.user_id;
                        token.username = dbUser.username;
                    }
                }
            }
            console.log("JWT Returning Token containing role:", token.role);
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
                (session.user as any).user_id = token.user_id;
                (session.user as any).username = token.username;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
};
