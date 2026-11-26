export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Figtree", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        ink: { 900: "#161A33", 800: "#1F2447", 700: "#2B3160", 500: "#5B6194", 100: "#E4E6F2", 50: "#F4F5FA" },
        marker: "#FFD84D",
        coral: "#E4572E",
        sea: "#2A9D8F",
      },
    },
  },
  plugins: [],
};
