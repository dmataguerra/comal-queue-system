import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import '../comun/styles/base.css';
import '../comun/styles/public.css';
import '../comun/styles/admin.css';
import { TurneroProvider } from '../comun/turnero';
import { OperadorPage } from './OperadorPage';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TurneroProvider>
      <OperadorPage />
    </TurneroProvider>
  </React.StrictMode>,
);
