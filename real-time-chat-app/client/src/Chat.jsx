
import { useState } from "react";

import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  gql,
  Observable,
} from "@apollo/client";

import {
  ApolloProvider,
  useQuery,
  useMutation,
  useSubscription,
} from "@apollo/client/react";

import { createClient } from "graphql-sse";
import { getMainDefinition } from "@apollo/client/utilities";

import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";

import "bootstrap/dist/css/bootstrap.min.css";

// ------------------------------------
// GraphQL SSE Link
// ------------------------------------

class SSELink extends ApolloLink {
  constructor(options) {
    super();
    this.client = createClient(options);
  }

  request(operation) {
    return new Observable((observer) => {
      return this.client.subscribe(
        {
          query: operation.query.loc.source.body,
          variables: operation.variables,
          operationName: operation.operationName,
        },
        {
          next: (result) => observer.next(result),
          error: (error) => observer.error(error),
          complete: () => observer.complete(),
        }
      );
    });
  }
}

// ------------------------------------
// Apollo Client Setup
// ------------------------------------

const httpLink = new HttpLink({
  uri: "http://localhost:4000/graphql",
});

const sseLink = new SSELink({
  url: "http://localhost:4000/graphql",
});

const link = ApolloLink.split(
  ({ query }) => {
    const definition = getMainDefinition(query);

    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  sseLink,
  httpLink
);

const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});

// ------------------------------------
// GraphQL Operations
// ------------------------------------

const GET_MESSAGES = gql`
  query {
    messages {
      id
      user
      content
    }
  }
`;

const POST_MESSAGE = gql`
  mutation ($user: String!, $content: String!) {
    postMessage(user: $user, content: $content)
  }
`;

const MESSAGES_SUBSCRIPTION = gql`
  subscription {
    messages {
      id
      user
      content
    }
  }
`;

// ------------------------------------
// Messages Component
// ------------------------------------

const Messages = ({ user }) => {
  const { data, loading, error } = useQuery(GET_MESSAGES);

  useSubscription(MESSAGES_SUBSCRIPTION, {
    onData: ({ data: subscriptionResult }) => {
      const messages = subscriptionResult.data?.messages;

      if (messages) {
        client.cache.writeQuery({
          query: GET_MESSAGES,
          data: { messages },
        });
      }
    },
  });

  if (loading && !data) {
    return <p>Loading messages...</p>;
  }

  if (error) {
    return <p>Error loading messages: {error.message}</p>;
  }

  return (
    <>
      {data?.messages?.map(
        ({ id, user: messageUser, content }) => (
          <div
            key={id}
            style={{
              display: "flex",
              justifyContent:
                user === messageUser ? "flex-end" : "flex-start",
              paddingBottom: "1em",
            }}
          >
            {user !== messageUser && (
              <div
                style={{
                  height: 50,
                  width: 50,
                  border: "2px solid #e5e6ea",
                  borderRadius: 25,
                  fontSize: "16px",
                  textAlign: "center",
                  marginRight: "0.5em",
                  paddingTop: 10,
                  flexShrink: 0,
                }}
              >
                {messageUser.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div
              style={{
                background:
                  user === messageUser ? "#58bf56" : "#e5e6ea",
                color: user === messageUser ? "white" : "black",
                padding: "1em",
                borderRadius: "1em",
                maxWidth: "60%",
                overflowWrap: "anywhere",
              }}
            >
              {content}
            </div>
          </div>
        )
      )}
    </>
  );
};

// ------------------------------------
// Form Input Component
// ------------------------------------

const FormInput = ({ label, value, onChange, onKeyUp }) => (
  <div className="p-1">
    <label>{label}</label>
    <input
      className="form-control"
      value={value}
      onChange={onChange}
      onKeyUp={onKeyUp}
    />
  </div>
);

// ------------------------------------
// Chat Component
// ------------------------------------

const Chat = () => {
  const [state, setState] = useState({
    user: "Alice",
    content: "",
  });

  const [postMessage, { loading: sending }] =
    useMutation(POST_MESSAGE);

  const onSend = async () => {
    const content = state.content.trim();
    const user = state.user.trim();

    if (!content || !user || sending) {
      return;
    }

    try {
      await postMessage({
        variables: { user, content },
      });

      setState((previous) => ({
        ...previous,
        content: "",
      }));
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <Container className="py-4">
      <h3 className="mb-3">Real-Time Chat</h3>

      <div
        style={{
          minHeight: 300,
          maxHeight: 450,
          overflowY: "auto",
          border: "1px solid #e5e6ea",
          borderRadius: "8px",
          padding: "1em",
          marginBottom: "1em",
        }}
      >
        <Messages user={state.user} />
      </div>

      <Row>
        <Col xs={3} md={2} style={{ padding: 0 }}>
          <FormInput
            label="User"
            value={state.user}
            onChange={(e) =>
              setState((previous) => ({
                ...previous,
                user: e.target.value,
              }))
            }
          />
        </Col>

        <Col xs={6} md={8} style={{ padding: 0 }}>
          <FormInput
            label="Message"
            value={state.content}
            onChange={(e) =>
              setState((previous) => ({
                ...previous,
                content: e.target.value,
              }))
            }
            onKeyUp={(e) => {
              if (e.key === "Enter") {
                onSend();
              }
            }}
          />
        </Col>

        <Col xs={3} md={2} style={{ marginTop: "28px" }}>
          <Button
            onClick={onSend}
            style={{ width: '100%' }}
            disabled={sending || !state.content.trim() || !state.user.trim()}
          >
            {sending ? "Sending..." : "Send"}
          </Button>
        </Col>
      </Row>
    </Container>
  );
};

// ------------------------------------
// App Entry Point
// ------------------------------------

export default function App() {
  return (
    <ApolloProvider client={client}>
      <Chat />
    </ApolloProvider>
  );
}
