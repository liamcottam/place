class Websocket {
  constructor() {
    this.conn = null;
    this.listeners = [];
  }
  connect() {
    this.conn = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws' }://${document.location.host}/ws`);
    this.conn.onopen = this.onOpen.bind(this);
    this.conn.onmessage = this.onMessage.bind(this);
    this.conn.onclose = this.onClose.bind(this);
    return this;
  }
  on(label, fn) {
    this.listeners[label] = fn;
  }
  emitToListeners(label, data) {
    this.listeners[label](data);
  }
  emit(opt, data) {
    this.conn.send(JSON.stringify([opt, data]));
  }
  onOpen() {
    this.emitToListeners('connect');
  }
  onMessage(evt) {
    const json = JSON.parse(evt.data);
    this.emitToListeners(json[0], json[1]);
  }
  onClose() {
    this.emitToListeners('disconnect');
    this.connect();
  }
}

const websocketManager = new Websocket();
export default websocketManager;
