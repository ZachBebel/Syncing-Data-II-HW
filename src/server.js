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
        artist = "",
        canvas,
        answer = "",
        guessCount = 0,
        newGame = false,
        gameStarted = false,

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

            // Sync client into existing game if there is one
            if (gameStarted) {
                socket.emit('drawToClient', canvas);
                socket.emit('msg', {
                    name: serverName,
                    msg: 'You have joined into the current game'
                });
            } else if (newGame) {
                socket.emit('msg', {
                    name: serverName,
                    msg: artist + ' is currently drawing'
                });
            }
        });
    };

    onMsg = function (socket) {

        socket.on('msgToServer', function (data) {

            var username = socket.name,
                message = data.msg,
                command = "/guess",
                time;


            if (message === "/new game") { // Start a new game with the command user as the artist

                if (!newGame) {

                    // Reset game stats
                    artist = username;
                    answer = "";
                    guessCount = 0;
                    newGame = true;

                    // Send message to everyone
                    io.sockets.in(roomName).emit('msg', {
                        name: username,
                        msg: message
                    });

                    // Tell clients to clear their canvas and guess count
                    io.sockets.in(roomName).emit('newGame');
                } else {

                    // Don't let users start a new game in the middle of a current one
                    socket.emit('msg', {
                        name: serverName,
                        msg: "A game is already in progress"
                    });
                }

            } else if (message === "/start") { // Submit record art & answer and sync with clients

                // Only start game if in a new game
                if (newGame) {
                    if (username === artist) {

                        // Send message to everyone
                        io.sockets.in(roomName).emit('msg', {
                            name: username,
                            msg: message
                        });

                        // Notify the artist to send canvas data to server
                        socket.emit('sendCanvas');

                        gameStarted = true;
                    } else {

                        // Non-artists can't submit canvas data
                        socket.emit('msg', {
                            name: serverName,
                            msg: "You are not the artist"
                        });
                    }
                } else {
                    socket.emit('msg', {
                        name: serverName,
                        msg: "A new game is required to start"
                    });
                }


            } else if (message.indexOf(command) > -1) { // Check user guesses against answer

                if (gameStarted) {
                    // Send message to everyone
                    io.sockets.in(roomName).emit('msg', {
                        name: username,
                        msg: message
                    });

                    // Get answer
                    message = message.split(command)[1].trim();
                    guessCount += 1;
                    io.sockets.in(roomName).emit('guess', guessCount);

                    // Check guess against answer
                    if (message === answer) {

                        newGame = false;
                        gameStarted = false;

                        // If correct, game over
                        message = socket.name + " has guessed correctly! Well done!";

                    } else {

                        // If incorrect
                        message = "Incorrect guess. Try again!";
                    }

                    // Send message to everyone
                    io.sockets.in(roomName).emit('msg', {
                        name: username,
                        msg: message
                    });
                } else {
                    socket.emit('msg', {
                        name: serverName,
                        msg: "The game has not started yet"
                    });
                }
            }

        });

        socket.on('drawToServer', function (data) {

            answer = data.answer;
            canvas = data.canvas;

            //grab ALL sockets in the room and emit the newly updated square to them. 
            //We are sending an "updatedMovement" message back to the user of our updated square
            //Remember io.sockets.in sends a message to EVERYONE in the room vs broadcast which sends to everyone EXCEPT this user. 
            io.sockets.in(roomName).emit('drawToClient', canvas);
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

            // Check for no users
            if (Object.keys(users).length < 1) {
                newGame = false;
                gameStarted = false;
            }
        });

    };

    io.sockets.on("connection", function (socket) {
        onJoined(socket);
        onMsg(socket);
        onDisconnect(socket);
    });

    console.log('Websocket server started');

}());