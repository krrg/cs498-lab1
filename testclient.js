'use strict'

var net = require('net');
const NUM_SOCKS = 100;

var numDone = 0;

for (let i = 0; i < NUM_SOCKS; i++) {

  let sock = new net.Socket();
  sock.connect(6379, 'localhost', function() {
    console.log(`Client ${i} is holding connection.`);

    sock.write(`SET KEY-${i} VAL-${i}\n`, function() {
      // When it is done writing.
      numDone += 1;
      console.log(`${numDone} sockets complete.`);
      if (numDone === NUM_SOCKS) {
        console.log("All sockets are completed.");
      }

      sock.end();
      sock.destroy();
    });
  })
}
