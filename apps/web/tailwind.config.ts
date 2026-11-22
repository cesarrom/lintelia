import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import defaultConfig from "tailwindcss/defaultTheme";

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config = {
  darkMode: "class",
  content: [
    './src/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultConfig.fontFamily.sans],
        mono: ["var(--font-mono)", ...defaultConfig.fontFamily.mono],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      colors: {
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        canvas: token("canvas"),
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
          soft: token("brand-soft"),
          strong: token("brand-strong"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        success: { DEFAULT: token("success"), soft: token("success-soft") },
        warning: { DEFAULT: token("warning"), soft: token("warning-soft") },
        info: { DEFAULT: token("info"), soft: token("info-soft") },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        /** A client app's accent colour (theme.accent), the brand colour when it has none. */
        highlight: {
          DEFAULT: token("highlight"),
          foreground: token("highlight-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
        sidebar: {
          DEFAULT: token("sidebar"),
          foreground: token("sidebar-foreground"),
        },
        /** Fixed brand scale for illustrations, gradients and marketing surfaces. */
        brand: {
          50: "#f2f0ff",
          100: "#e6e2ff",
          200: "#cfc8ff",
          300: "#ada1fd",
          400: "#8a78f8",
          500: "#6d58f0",
          600: "#5b43e3",
          700: "#4b34c6",
          800: "#3e2ca0",
          900: "#34297d",
          950: "#1e174a",
        },
      },
      borderRadius: {
        "2xl": "calc(var(--radius) + 8px)",
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(16 24 40 / 0.05)",
        card: "0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.04)",
        raised: "0 1px 2px rgb(16 24 40 / 0.04), 0 4px 12px -2px rgb(16 24 40 / 0.08)",
        overlay: "0 24px 48px -12px rgb(16 24 40 / 0.25), 0 0 0 1px rgb(16 24 40 / 0.04)",
        "inset-highlight": "inset 0 1px 0 0 rgb(255 255 255 / 0.18)",
        glow: "0 0 0 1px hsl(var(--primary) / 0.2), 0 8px 24px -6px hsl(var(--primary) / 0.45)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;

export default config;
