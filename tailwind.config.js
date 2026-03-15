/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // 使用 class 策略实现深色模式
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
