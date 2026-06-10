import { createBrowserRouter } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { BookDetail } from './pages/BookDetail';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Settings } from './pages/Settings';
import { PurchaseHistory } from './pages/PurchaseHistory';
import { Trending } from './pages/Trending';
import { Genre } from './pages/Genre';
import { SearchPage } from './pages/SearchPage'; 
import { ErrorPage } from './components/ErrorPage';
import { TrendingAll } from './pages/TrendingAll';
export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    errorElement: <ErrorPage />,
    children: [
      { index: true, Component: Home },
      { path: 'profile', Component: Profile },
      { path: 'book/:id', Component: BookDetail },
      { path: 'settings', Component: Settings },
      { path: 'purchases', Component: PurchaseHistory },
      { path: 'trending', Component: Trending },
      { path: 'trending-all', Component: TrendingAll },
      { path: 'genre/:genre', Component: Genre },
      { path: 'search', Component: SearchPage }, 
    ],
  },
  // Auth pages without layout
  { path: 'login', Component: Login },
  { path: 'register', Component: Register },
]);