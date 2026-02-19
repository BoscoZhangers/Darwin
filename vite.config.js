import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'

// 1. Create a custom Vite logger
const logger = createLogger()
const originalWarn = logger.warn

// 2. Intercept warnings
logger.warn = (msg, options) => {
  // 3. If the message contains the specific Babel warning, do nothing (silence it)
  if (msg.includes('deoptimised the styling') || msg.includes('500KB')) {
    return
  }
  // Otherwise, print the warning normally
  originalWarn(msg, options)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  customLogger: logger, // 4. Apply the custom logger
})