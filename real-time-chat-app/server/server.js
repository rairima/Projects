
const { createServer } = require('http');
const {
  createYoga,
  createSchema,
  createPubSub,
} = require('graphql-yoga');

const messages = [];
const pubSub = createPubSub();

const typeDefs = `
  type Message {
    id: ID!
    user: String!
    content: String!
  }

  type Query {
    messages: [Message!]!
  }

  type Mutation {
    postMessage(user: String!, content: String!): ID!
  }

  type Subscription {
    messages: [Message!]!
  }
`;

const resolvers = {
  Query: {
    messages: () => messages,
  },

  Mutation: {
    postMessage: (_, { user, content }) => {
      const id = messages.length;

      const message = {
        id: String(id),
        user,
        content,
      };

      messages.push(message);

      // Notify all active subscribers.
      pubSub.publish('MESSAGES', { messages });

      return String(id);
    },
  },

  Subscription: {
  messages: {
    subscribe: () => pubSub.subscribe('MESSAGES'),
    resolve: (payload) => payload.messages,
  },
},
};

const schema = createSchema({
  typeDefs,
  resolvers,
});

const yoga = createYoga({
  schema
//  context: () => ({ pubSub }),
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log('Server is running on http://localhost:4000/graphql');
});
