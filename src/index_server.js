import { STTServer } from './server/servermain';

let root = document.createElement('div');
root.id = 'root';
root.innerText = 'Server starting...';
document.body.appendChild(root);

let sttServer = new STTServer();

sttServer.start((msg) => {
    root.innerText += '\n' + msg;
});
