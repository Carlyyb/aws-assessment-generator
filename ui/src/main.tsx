import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import App from './App.tsx';
import { initializeLanguage } from './i18n/initialize';
import '@cloudscape-design/global-styles/index.css';
import '@aws-amplify/ui-react/styles.css';
import './index.css';

fetch('/config.json')
  .then((res) => res.json())
  .then((config) => {
    Amplify.configure(config);
    
    // 在应用启动前初始化语言设置
    initializeLanguage();

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
