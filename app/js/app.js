(function(){
  ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onopen = (event) => {
    console.log(event);
    ws.send("Connection Opened! Hello.");
  }

  ws.onmessage = (event) => {
    console.log(event);
  }

  ws.onclose = (event) => {
    console.log("Connection closed");
  }
})();
