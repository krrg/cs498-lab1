import signal
import pyuv


class KeyValueStore(object):

    def __init__(self):
        self.values = {}

    def get(self, key):
        return self.values.get(key, None)

    def delete(self, key):
        self.values.pop(key, None)

    def set(self, key, value):
        self.values[key] = value

globalStore = KeyValueStore()


class Server(object):

    def __init__(self):
        self.clients = []
        self.serverSocket = None

    def start(self):
        self.server = pyuv.TCP(pyuv.Loop.default_loop())
        self.server.bind(('0.0.0.0', 6379))  # Notice the tuple parameter
        self.server.listen(self.handle_pending_client)

        # Make sure to listen for SIGINT to happen so ^C works.
        self.sigint = pyuv.Signal(pyuv.Loop.default_loop())
        self.sigint.start(self.handle_end_signal, signal.SIGINT)

    def handle_pending_client(self, server, err):
        client = pyuv.TCP(server.loop)
        server.accept(client)

        serverClient = ServerClient(client)
        self.clients.append(serverClient)
        # Begin the "recursive" read chain.
        client.start_read(serverClient.handle_data_available)

    def handle_end_signal(self, handle, signum):
        for c in self.clients:
            c.close()
        self.sigint.close()
        self.server.close()


class ServerClient(object):

    def __init__(self, client):
        self.client = client
        self.data = ""
        client.start_read(self.handle_data_available)

    def close(self):
        self.client.close()

    def parse_command(self):
        chunks = self.data.strip().split()

        if chunks[0] == 'GET':
            self.handle_GET(chunks)
        elif chunks[0] == 'SET':
            self.handle_SET(chunks)
        elif chunks[0] == 'DEL':
            self.handle_DEL(chunks)
        else:
            self.handle_INVALID()

        self.data = ""

    def handle_GET(self, chunks):
        if len(chunks) != 2:
            return self.handle_BAD_LENGTH(chunks)
        value = str(globalStore.get(chunks[1]))
        self.send("{}\n".format(value))

    def handle_SET(self, chunks):
        if len(chunks) != 3:
            return self.handle_BAD_LENGTH(chunks)
        globalStore.set(chunks[1], chunks[2])
        self.send("1\n")

    def handle_DEL(self, chunks):
        if len(chunks) != 2:
            return self.handle_BAD_LENGTH(chunks)
        result = 0 if globalStore.get(chunks[1]) is None else 1
        globalStore.delete(chunks[1])
        self.send("{}\n".format(result))

    def handle_INVALID(self, chunks):
        self.send("Invalid command `{}`\n".format(chunks[0]))

    def handle_BAD_LENGTH(self, chunks):
        self.send("Wrong number of parameters ({}) for command `{}`\n".format(len(chunks), chunks[0]))

    def send(self, data):
        self.client.write(data)

    def handle_data_available(self, client, data, err):
        if err:
            print "There was an error:", err
            return

        for c in data:
            if c == '\n':
                self.parse_command()
            elif c == '\0':
                self.close()
                return
            elif c == '\r':
                continue  # Skip carriage returns.
            else:
                self.data += c

        client.start_read(self.handle_data_available)


if __name__ == '__main__':

    print "Beginning the server..."
    main_loop = pyuv.Loop.default_loop()
    S = Server()
    S.start()
    main_loop.run()
    print "Ending..."
