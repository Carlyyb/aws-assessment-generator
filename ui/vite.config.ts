// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 根据当前模式加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    // 开发服务器配置只在开发模式下生效
    ...(mode === 'development' ? {
      server: {
        port: 5173,
        proxy: {
          '/api': {
            target: env.VITE_APP_API_ENDPOINT,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
          },
        },
      }
    } : {}),
    
    // 生产构建配置
    build: {
      outDir: 'dist',
      sourcemap: false,
      // 生产环境优化
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom'],
            'aws': ['aws-amplify', '@aws-amplify/ui-react']
          }
        }
      }
    },

    // 环境变量定义
    define: {
      // 在生产模式下，这些值会被 CDK 部署时的实际值替换
      'process.env.VITE_APP_API_ENDPOINT': JSON.stringify(env.VITE_APP_API_ENDPOINT),
      'process.env.VITE_APP_REGION': JSON.stringify(env.VITE_APP_REGION),
      'process.env.VITE_APP_USER_POOL_ID': JSON.stringify(env.VITE_APP_USER_POOL_ID),
      'process.env.VITE_APP_USER_POOL_WEB_CLIENT_ID': JSON.stringify(env.VITE_APP_USER_POOL_WEB_CLIENT_ID),
    },
  }
})
