/*global require, process, __dirname, console */

(function () {

    "use strict";

    var http = require('http'),
        fs = require('fs'),
        socketio = require('socket.io'),
        port = process.env.PORT || process.env.NODE_PORT || 3000,

        //read the client html file into memory
        //__dirname in node is the current directory //in this case the same folder as the server js file
        index = fs.readFileSync(__dirname + '/../client/client.html'),
        app,
        io,

        // Server Vars
        users = {},
        roomName = 'Room1',
        serverName = '[[Server]]',

        // Game Vars
        answer = "",
        guessCount = 0,

        // Functions
        onJoined,
        onMsg,
        onDisconnect;

    function onRequest(request, response) {

        response.writeHead(200, {
            "Content-Type": "text/html"
        });
        response.write(index);
        response.end();
    }
    app = http.createServer(onRequest).listen(port);
    console.log("Listening on 127.0.0.1:" + port);

    // pass in the http server into socketio and grab the websocket server as io
    io = socketio(app);
    // object to hold all of our connected users
    users = {};

    onJoined = function (socket) {

        socket.on('join', function (data) {
            var joinMsg = {
                name: serverName,
                msg: 'There are ' + Object.keys(users).length + ' users online'
            };
            socket.emit('msg', joinMsg);
            socket.name = data.name;
            socket.join(roomName);

            // Broadcast to everyone else
            socket.broadcast.to(roomName).emit('msg', {
                name: serverName,
                msg: data.name + " has joined the room"
            });

            // Emit to yourself (server)
            socket.emit('msg', {
                name: serverName,
                msg: 'You joined the room'
            });

            // Add user to object
            users[data.name] = roomName;
        });
    };

    onMsg = function (socket) {

        socket.on('msgToServer', function (data) {

            var username = socket.name,
                message = data.msg,
                command = "/guess",
                time;


            if (message === "/new game") {

                // Dice roll
                io.sockets.in(roomName).emit('msg', {
                    name: username,
                    msg: message
                });
                message = username + " has rolled a " + Math.floor((Math.random() * 6) + 1) + " on a six-sided die";

            } else if () {

                // Action commands
                message = socket.name + message.split(command)[1];

            } else if (message.indexOf(command) > -1) {

                // Send to yourself
                socket.emit('msg', {
                    name: username,
                    msg: message
                });

                // Server time
                time = new Date();
                message = "Current time: " + time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds();
                socket.emit('msg', {
                    name: serverName,
                    msg: message
                });

                return;
            }

            // Send to everyone
            io.sockets.in(roomName).emit('msg', {
                name: username,
                msg: message
            });
        });

        socket.on('drawToServer', function (data) {

            //grab ALL sockets in the room and emit the newly updated square to them. 
            //We are sending an "updatedMovement" message back to the user of our updated square
            //Remember io.sockets.in sends a message to EVERYONE in the room vs broadcast which sends to everyone EXCEPT this user. 
            io.sockets.in(roomName).emit('drawToClient', data);
        });

    };

    onDisconnect = function (socket) {

        socket.on('disconnect', function (data) {

            // Send to everyone but yourself
            socket.broadcast.to(roomName).emit('msg', {
                name: serverName,
                msg: socket.name + " has left the room"
            });

            // Leave room
            socket.leave(roomName);

            // Remove user from object
            delete users[socket.name];
        });

    };

    io.sockets.on("connection", function (socket) {
        onJoined(socket);
        onMsg(socket);
        onDisconnect(socket);
    });

    console.log('Websocket server started');

}());