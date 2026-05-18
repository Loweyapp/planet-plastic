import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    __ANTHROPIC_KEY__: JSON.stringify(process.env.VITE_ANTHROPIC_API_KEY || '')
  }
})
