import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import '../common/styles/base.css';
import '../common/styles/public.css';
import '../common/styles/theme.css';
import '../common/size';
import '../common/theme';
import { QueueProvider } from '../common/queue-context';
import { DisplayPage } from './DisplayPage';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueueProvider>
      <DisplayPage />
    </QueueProvider>
  </React.StrictMode>,
);
