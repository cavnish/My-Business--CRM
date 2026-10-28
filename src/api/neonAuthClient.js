import { createInternalNeonAuth } from "@neondatabase/auth";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

if (!authUrl) {
  throw new Error("VITE_NEON_AUTH_URL must be configured to use Neon Auth.");
}

const neonAuthClient = createInternalNeonAuth(authUrl);

export const neonAuth = neonAuthClient.adapter;
export const getNeonAuthToken = () => neonAuthClient.getJWTToken();
