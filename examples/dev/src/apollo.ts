import { ApolloClient, InMemoryCache } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

function defaultWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}/subscriptions`;
}

/** K 线订阅用 Apollo；HTTP 查询历史 K 线见 `queryKline`（fetch `/query`） */
export function createApolloClient(): ApolloClient {
  const url = import.meta.env.VITE_GRAPHQL_WS ?? defaultWsUrl();
  const wsLink = new GraphQLWsLink(
    createClient({
      url,
      connectionParams: () => {
        const token = import.meta.env.VITE_GRAPHQL_AUTH_TOKEN;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  );
  return new ApolloClient({
    link: wsLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'no-cache' },
      query: { fetchPolicy: 'no-cache' },
    },
  });
}
