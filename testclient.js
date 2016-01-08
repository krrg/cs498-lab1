'use strict'

var net = require('net');
var Promise = require('bluebird');
var mocha = require('mocha');
var child_process = require('child_process');
var assert = require('assert');
var _ = require('lodash');

Promise.promisifyAll(net.Socket.prototype)


class LineListener {

  /* Expects a promisified socket! */
  constructor(sock) {
    this.sock = sock;
    this.completedLines = [];
    this.receivingLine = "";
    this.readLineQueue = [];

    let self = this;

    this.sock.on('data', (data) => {
      data.toString().split('').forEach((c) => {
        if (c === '\n') {
          self.completedLines.push(self.receivingLine);
          self.receivingLine = "";
          if (self.readLineQueue.length > 0) {
            self.readLineQueue.shift()();
          }
        } else {
          self.receivingLine += c;
        }
      });
    })
  }

  writeLine(text) {
    return this.sock.writeAsync(text + "\n");
  }

  readLine(text) {
    let self = this;

    if (self.completedLines.length > 0) {
      return Promise.resolve(self.completedLines.shift());
    } else {
      return new Promise((resolve, reject) => {
        self.readLineQueue.push(() => {
          resolve(self.completedLines.shift());
        });
      });
    }

  }

}


describe("Simple key-value store server", function() {

  let subprocess = null;

  beforeEach(Promise.coroutine(function* () {
    subprocess = child_process.spawn('./env/bin/python', ['server.py']);
  }));

  afterEach(() => {
    if (subprocess) {
      subprocess.kill();
      subprocess = null;
    }
  })

  it("GET returns `None` if key does not exist", Promise.coroutine(function* () {
    let sock = new net.Socket();
    yield sock.connectAsync(6379, 'localhost');
    let wrap = new LineListener(sock);

    wrap.writeLine("GET nosuchkey");
    let result = yield wrap.readLine();

    assert(result.trim() === 'None');
  }))

  it("executes SET", Promise.coroutine(function* () {
    let sock = new net.Socket();
    yield sock.connectAsync(6379, 'localhost');
    let wrap = new LineListener(sock);

    wrap.writeLine("SET anewkey anewvalue");
    let result = yield wrap.readLine();
    assert(result.trim() === '1');
  }));

  it("can retrieve a previously SET value", Promise.coroutine(function* () {
    let sock = new net.Socket();
    yield sock.connectAsync(6379, 'localhost');
    let wrap = new LineListener(sock);

    yield wrap.writeLine("SET somekey somevalue");
    let result = yield wrap.readLine();

    yield wrap.writeLine("GET somekey");
    result = yield wrap.readLine();
    assert(result.trim() === 'somevalue');
  }));

  it("can delete a previously SET value", Promise.coroutine(function* () {
    let sock = new net.Socket();
    yield sock.connectAsync(6379, 'localhost');
    let wrap = new LineListener(sock);

    yield wrap.writeLine("SET somekey somevalue");
    let result = yield wrap.readLine();

    yield wrap.writeLine("DEL somekey");
    result = yield wrap.readLine();

    yield wrap.writeLine("GET somekey");
    result = yield wrap.readLine()
    assert(result.trim() === 'None');

  }))

  it("maintains two open connections and respond to them", Promise.coroutine(function* () {
    let sock1 = new net.Socket();
    yield sock1.connectAsync(6379, 'localhost');
    let wrap1 = new LineListener(sock1);

    let sock2 = new net.Socket();
    yield sock2.connectAsync(6379, 'localhost');
    let wrap2 = new LineListener(sock2);

    // Notice the wrap2 issues the SET, and then holds its connection open.
    yield wrap2.writeLine("SET firstKey firstValue");
    yield wrap1.writeLine("GET firstKey");
    let result = yield wrap1.readLine();

    assert(result.trim() === 'firstValue');
  }))

  it("maintains multiple open connections", Promise.coroutine(function* () {
    const NUM_SOCKETS = 250;

    let pendingSockets = _.range(NUM_SOCKETS).map(Promise.coroutine(function*(){
      let sock = new net.Socket();
      yield sock.connectAsync(6379, 'localhost')
      return sock;
    }))

    let sockets = yield Promise.all(pendingSockets);

    let wrappers = sockets.map((s) => {
      return new LineListener(s);
    });

    let expectedResponses = _.zipObject(_.range(NUM_SOCKETS), _.range(NUM_SOCKETS).reverse());

    yield Promise.all(wrappers.map((wrapper, index) => {
      let key = `${index}`;
      let value = `${expectedResponses[key]}`
      wrapper.writeLine(`SET ${value} ${value}`);
      return wrapper.readLine();
    }))

    yield Promise.all(wrappers.map(Promise.coroutine(function* (wrapper, index) {
      var key = `${index}`;
      wrapper.writeLine(`GET ${key}`);
      let result = yield wrapper.readLine();
      assert(result.trim() === key);
    })));

  }));

});
