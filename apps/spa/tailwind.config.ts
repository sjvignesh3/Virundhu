import type { Config } from "tailwindcss";

/**
 * Virundhu owner console + storefront — dark-first theme matching the
 * production design (see Docs/Screenshots): warm near-black ground,
 * orange accent, soft rounded cards.
 *
 * DELIBERATE MAPPING: the app is single-theme (dark). Instead of sweeping
 * hundreds of class names, the neutral scale is remapped so that code
 * written "light-first" (bg-white cards on neutral-50, neutral-900 text)
 * renders the dark design: `white` = card surface, `neutral-50` = page
 * ground, and the 100→900 ramp runs dark→light. Treat the scale as
 * SEMANTIC (50 = ground, white = surface, 900 = highest-contrast text).
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#F97316", // orange-500 — primary actions
          dark: "#EA580C",
          soft: "#3A2413", // translucent-orange panel fill
          fg: "#FFFFFF",
        },
        white: "#211B16", // card / panel surface
        neutral: {
          50: "#120E0B", // page ground
          100: "#2A2119", // hover fill / subtle panel
          200: "#332921", // hairline borders
          300: "#453931", // strong borders / disabled
          400: "#8D8073", // faint text / icons
          500: "#A99C8F", // muted text
          600: "#C7BBAE", // secondary text
          700: "#DED4C8", // emphasized secondary
          800: "#EDE5DC",
          900: "#F7F2EC", // primary text
        },
        // Semantic tints re-pitched for the dark ground.
        red: {
          50: "#391511",
          200: "#5D231B",
          600: "#DC2626",
          700: "#F49287",
        },
        green: {
          100: "#12351F",
          700: "#63D68C",
        },
        emerald: {
          100: "#0F3A28",
          600: "#4ADE80",
        },
        amber: {
          100: "#3B2B10",
          800: "#EAB65C",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.4)",
        glow: "0 0 40px rgba(249,115,22,0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
