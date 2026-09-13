import {SystemProvider} from './hooks/useSystem';
import {CashierPage} from './pages/CashierPage';
import {PublicPage} from './pages/PublicPage';
export function App(){return <SystemProvider>{window.location.pathname.startsWith('/pantalla')?<PublicPage/>:<CashierPage/>}</SystemProvider>;}
