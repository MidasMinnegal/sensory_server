const { WebSocket, WebSocketServer } = require('ws');
const http = require('http');
const uuidv4 = require('uuid').v4;

// Receive commands
const SET_ROLE_CLIENT = "SET_ROLE_CLIENT"
const REQUEST_CLIENT_LIST = "REQUEST_CLIENT_LIST"
const ARD_ACTION = "ARD_ACTION"

// Send commands
const UPDATED_CLIENT_LIST = "UPDATED_CLIENT_LIST"
const UPDATED_WEBCLIENT_LIST = "UPDATED_WEBCLIENT_LIST"
const ARD_DO = "ARD_DO"

// Spinning the http server and the WebSocket server.
const server = http.createServer();
const wsServer = new WebSocketServer({ server });
const port = 8000;
server.listen(port, () => {
  console.log(`WebSocket server is running on port ${port}`);
});

// I'm maintaining all active connections in this object
const clients = {};
let webClients = []

const clientListUpdated = () => {
  // Send this to the web clients only
  for(let userId in clients) {
    if(!webClients.some((webId) => webId === userId)) continue
    const client = clients[userId];
    if (client.readyState === WebSocket.OPEN) {
      console.log('Setting client list updated: ', Object.keys(clients))
      client.send(`${UPDATED_WEBCLIENT_LIST}|${webClients.toString()}`);
      client.send(`${UPDATED_CLIENT_LIST}|${Object.keys(clients).toString()}`);
    }
  }
}

function broadCastToClient(id, data) {
  const client = clients[id];
  console.log(client)
  if(client.readyState === WebSocket.OPEN) {
    console.log('Sending ' + data + ' to ' + id)
    client.send(`${ARD_DO}|${data.toString()}`);
  }
}

function broadcastMessage(data) {
  // We are sending the current data to all connected clients
  for(let userId in clients) {
    let client = clients[userId];
    if(client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  };
}

function handleMessage(message, userId) {
  const dataFromClient = message.toString()
  console.log(dataFromClient)
  if(dataFromClient === SET_ROLE_CLIENT) {
    console.log("Adding web client")
    webClients.push(userId)
  }

  if(dataFromClient.split("|")[0] === ARD_ACTION) {
    const [id, data] = dataFromClient.split("|")[1].split(',')
    broadCastToClient(id, data)
  }

  if(dataFromClient === REQUEST_CLIENT_LIST) {
    clientListUpdated()
  }

  if(webClients.includes(userId)) {
    console.log("message was send from a client")
  }
  broadcastMessage(dataFromClient);
}

function handleDisconnect(userId) {
  console.log(`${userId} disconnected.`);
  delete clients[userId];
  webClients = webClients.filter((id) => id !== userId)
  clientListUpdated()
}

// A new client connection request received
wsServer.on('connection', function(connection) {
  // Generate a unique code for every user
  const userId = uuidv4();
  // Store the new connection and handle messages
  clients[userId] = connection;
  console.log(`${userId} connected.`);

  connection.on('message', (message) => handleMessage(message, userId));
  // User disconnected
  connection.on('close', () => handleDisconnect(userId));
});