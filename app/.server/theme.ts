import { createCookie } from "react-router";
import { createTypedCookie } from "remix-utils/typed-cookie";
import { z } from "zod";
import { cookieSecret } from "./env";

// Create a cookie using React Router's createCookie API
const cookie = createCookie("color-scheme", {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secrets: [cookieSecret()],
});

// Create a Zod schema to validate the cookie value
export const schema = z
  .enum(["dark", "light", "system"]) // Possible color schemes
  .default("system") // If no cookie, default to "system"
  .catch("system"); // In case of an error, default to "system"

// Use Remix Utils to ensure the cookie value is always parsed
const typedCookie = createTypedCookie({ cookie, schema });

// Helpers to get and set the cookie
export async function getColorScheme(request: Request) {
  const colorScheme = await typedCookie.parse(request.headers.get("Cookie"));
  return colorScheme ?? "system";
}

export async function setColorScheme(colorScheme: z.infer<typeof schema>) {
  return await typedCookie.serialize(colorScheme);
}