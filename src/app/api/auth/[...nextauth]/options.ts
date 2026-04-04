import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import pool from "@/lib/db";

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

            try {
                const res = await pool.query(
                    'SELECT * FROM Users WHERE LOWER(user_email) = $1 OR LOWER(user_name) = $1',
                    [email]
                );
                const dbUser = res.rows[0];

                if (!dbUser) {
                    console.warn(`Unauthorized login attempt from ${email}. Not found in PostgreSQL.`);
                    return false; 
                }
                return true; 
            } catch (err) {
                console.error("Database error during NextAuth signIn:", err);
                return false;
            }
        },
        async jwt({ token, user, profile }) {
            if (user || profile) {
                const email = (token.email || user?.email || (profile as any)?.preferred_username || "").toLowerCase().trim();
                token.email = email;

                const res = await pool.query(
                    'SELECT * FROM Users WHERE LOWER(user_email) = $1 OR LOWER(user_name) = $1',
                    [email]
                );
                const dbUser = res.rows[0];

                if (dbUser) {
                    token.role = dbUser.user_role || "USER"; 
                    token.user_id = dbUser.user_id;
                    token.username = dbUser.user_name;
                    console.log(`JWT: Resolved role (${token.role}) from PG for:`, email);
                } else {
                    console.warn(`JWT: User not found in PG:`, email);
                    token.role = "USER";
                }
            }
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
