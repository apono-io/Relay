import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

const isDevelopment = import.meta.env.DEV;
const apiUrl = isDevelopment ? (import.meta.env.VITE_API_URL || 'http://localhost:3000') : '/apn';

const httpLink = createHttpLink({
  uri: `${apiUrl}/graphql`,
  credentials: 'include',
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message }) => {
      if (message.includes('Unauthorized') || message.includes('not authenticated')) {
        if (window.location.pathname !== '/login' && !window.location.pathname.includes('/auth/callback')) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'all' },
    query: { fetchPolicy: 'network-only', errorPolicy: 'all' },
  },
});

export default client;
