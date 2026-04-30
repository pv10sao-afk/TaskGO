/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617', // Dark theme background
        },
        lime: {
          400: '#a3e635', // Primary accent color
        }
      }
    },
  },
  plugins: [],
}
