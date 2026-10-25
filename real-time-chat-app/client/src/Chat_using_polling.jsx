import { useState } from "react";
import {
ApolloClient, 
HttpLink,
InMemoryCache, 
gql, 
Observable
} from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-sse";
import { ApolloProvider, useQuery, useMutation } from "@apollo/client/react";

import Container from 'react-bootstrap/Container';
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import "bootstrap/dist/css/bootstrap.min.css";

const client = new ApolloClient({
    link: new HttpLink({ uri: "http://localhost:4000/graphql" }),
    cache: new InMemoryCache(),
});

const GET_MESSAGES = gql`query {
  messages {
    id,
    user,
    content
  }
}`;

const POST_MESSAGE = gql`mutation ($user: String!, $content: String!) {
   postMessage(user: $user, content: $content)
}`;

const Messages = ({ user }) => {
    const { data } = useQuery(GET_MESSAGES, {
        pollInterval: 500,
    });
    if (!data) {
        return null;
    }
    return (
        <>
            {data?.messages?.map(({ id, user: messageUser, content }) => (
                <div key={id} style={{
                    display: 'flex',
                    justifyContent: user === messageUser ? 'flex-end' : 'flex-start',
                    paddingBottom: '1em'
                }}>
                    {user !== messageUser && (
                        <div style={{
                            height: 50,
                            width: 50,
                            border: '2px solid #e5e6ea',
                            borderRadius: 25,
                            fontSize: '16px',
                            textAlign: 'center',
                            marginRight: '0.5em',
                            paddingTop: 10,
                        }}>
                            {messageUser.slice(0, 2).toUpperCase()}
                        </div>
                    )}


                    <div style={{
                        background: user === messageUser ? '#58bf56' : '#e5e6ea',
                        color: user === messageUser ? 'white' : 'black',
                        padding: '1em',
                        borderRadius: '1em',
                        maxWidth: '60%'
                    }}>

                        {content}
                    </div>
                </div>
            ))}
        </>
    )
};


const FormInput = ({ label, value, onChange }) => (
    <div className="p-1">
        <label>{label}</label>
        <input
            className="form-control"
            value={value}
            onChange={onChange}
        />
    </div>
);

const Chat = () => {
    const [state, setState] = useState({
        user: "Alice",
        content: ""
    });

    const [postMessage] = useMutation(POST_MESSAGE);

    const onSend = () => {
        if (state.content.length > 0) {
            postMessage({
                variables: state
            });
        }
        setState({
            ...state, content: ''
        })
    }

    return (
        <Container>
            <Messages user={state.user} />
            <Row>
                <Col xs={2} style={{ padding: 0 }}>
                    <FormInput
                        label='User'
                        value={state.user}
                        onChange={(e) => setState({ ...state, user: e.target.value })}
                    />
                </Col>
                <Col xs={8} style={{ padding: 0 }}>
                    <FormInput
                        label='Content'
                        value={state.content}
                        onChange={(e) => setState({ ...state, content: e.target.value })}
                        onKeyUp={(e) => {
                            if (e.keyCode === 13) {
                                onSend();
                            }
                        }}
                    />
                </Col>
                <Col xs={2} style={{ marginTop: '28px', padding: 0 }}>
                    <Button onClick={() => onSend()}>
                        Send
                    </Button>
                </Col>
            </Row>
        </Container>
    )
}

export default () => (
    <ApolloProvider client={client}>
        <Chat />
    </ApolloProvider>
)