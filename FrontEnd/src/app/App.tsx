import { RouterProvider } from 'react-router';
import { router } from './routes';
import { BookProvider } from './hooks/useBooks';

export default function App() {
  return (
    <BookProvider>
      <RouterProvider router={router} />
    </BookProvider>
  );
}
