
import React from 'react';
import { createRoot } from 'react-dom/client';
import Container from "react-bootstrap/Container";

import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";

import Chat from 'chat/Chat';

const rootElement = document.getElementById('root');

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
   <Container>
    <h1>Chat!</h1>
    <Chat />
    <p></p>
   </Container>
     
  </React.StrictMode>
);
