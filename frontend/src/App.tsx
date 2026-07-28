import { ApolloProvider } from '@apollo/client';
import { BrowserRouter } from 'react-router-dom';
import client from './apollo-client';
import { ColorModeProvider } from '@/context/ColorModeContext';
import { AuthProvider } from '@/context/AuthContext';
import { AppRoutes } from './routes';

export function App() {
  return (
    <ApolloProvider client={client}>
      <ColorModeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ColorModeProvider>
    </ApolloProvider>
  );
}
