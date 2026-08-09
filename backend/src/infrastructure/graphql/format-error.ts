import { GraphQLFormattedError } from 'graphql';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  503: 'SERVICE_UNAVAILABLE',
};

export function formatGraphqlError(
  error: GraphQLFormattedError,
): GraphQLFormattedError {
  const originalError = error.extensions?.originalError as
    { statusCode?: number; message?: string } | undefined;
  const status =
    originalError?.statusCode ?? (error.extensions?.status as number) ?? 500;
  const apolloCode = error.extensions?.code as string | undefined;
  const code =
    apolloCode && apolloCode !== 'INTERNAL_SERVER_ERROR'
      ? apolloCode
      : (CODE_BY_STATUS[status] ?? 'INTERNAL_SERVER_ERROR');
  return {
    message: error.message,
    path: error.path,
    extensions: { code, status },
  };
}
