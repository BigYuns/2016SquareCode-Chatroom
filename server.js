var express = require('express'), 
	bodyParser = require("body-parser"), 
	anyDB = require('any-db'),
	path    = require("path"),
	engines = require('consolidate'); 
    bootstrap = require("express-bootstrap-service");



/* Connection to the databse called chatroom.db and create a table*/
var conn = anyDB.createConnection('sqlite3://chatroom.db'); 
/*Q :On the instruction:  Note well that room names must be unique, 
and you will get a database error if you try to reuse one. 
Be sure to handle that error, and generate a new identifier under those circumstances.
A: UNIQUE can be the solution? Or should I handle the situation? */
var sql_create = 'CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, nickname TEXT NOT NULL UNIQUE, body TEXT, time INTEGER )'; 
conn.query(sql_create).on('end', function(){
	console.log("Made table!"); 
})

/*Query */

/*Build the app in express*/
var app = express(); 

var http = require('http'); 
var server = http.createServer(app); 

// add socket.io
var io = require('socket.io').listen(server);
/*tell Express to run .html files through Hogan */
app.engine('html', engines.hogan); 
/*tell Express where to find templates*/
app.set('views', __dirname + '/templates'); 
app.use("/scripts", express.static(__dirname+'/scripts')); 
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bootstrap.serve);

app.get('/', function(req,res){
 	res.render('index.html'); 
});

var test_set = new Set();
app.get('/generate', function(request,response){
	var chatroomId = generateRoomIdentifier(); 
	while(test_set.has(chatroomId)){
		chatroomId = generateRoomIdentifier(); 
	}
	test_set.add(chatroomId); 
	response.redirect('/'+chatroomId); 
}); 

app.get('/:roomName', function(request,response){
	var name = request.params.roomName; 
	if(name != 'favicon.ico'){
		response.render('chatroom.html', {roomName: name}); 
	}
}); 

var roomNames = Array.from(test_set); 
io.sockets.on('connection', function(socket){
    // clients emit this when they join new rooms
    socket.on('join', function(roomName, nickname, callback){
        socket.join(roomName); // this is a socket.io method
        socket.nickname = nickname; // yay JavaScript! see below
        socket.roomname = roomName; 
        // get a list of messages currently in the room, then send it back
        var clients_in_the_room = io.sockets.in(roomName);

        var users = [];
        for (var s in clients_in_the_room.connected){
            if(io.sockets.connected[s].roomname==roomName){
                var client_nickname = io.sockets.connected[s].nickname;
                if(client_nickname!=undefined){
                    users.push(client_nickname); 
                } 
            }     
        }
        io.sockets.in(roomName).emit('newMember', users); 
        var messages = [];
       	var sql = 'SELECT id, nickname, body FROM messages WHERE room='+'"'+roomName+'"';
        var q = conn.query(sql, function(err,result){
        	if(result.rows.length!=0){
        		for(var i=0; i<result.rows.length; i++){
        			var row = result.rows[i]; 
        			var item = {
        				id: row.id, 
        				nickname: row.nickname,
        				body: row.body 
        			}
        			if(item!=undefined){
        				messages.push(item);
        			}
        		}
        	}
        	callback(messages);
        }); 
    });

    
    socket.on('changeName', function(changedNickname){
        var oldNickname= socket.nickname; 
        var roomName = Object.keys(io.sockets.adapter.sids[socket.id])[1];
        socket.nickname = changedNickname; 
        socket.roomname = roomName; 

        var clients_in_the_room = io.sockets.in(roomName);
        var users = [];
        for (var s in clients_in_the_room.connected){
            if(io.sockets.connected[s].roomname==roomName){
                var client_nickname = io.sockets.connected[s].nickname;
                if(client_nickname!=undefined){
                    users.push(client_nickname); 
                } 
            } 
        }
        io.sockets.in(roomName).emit('newMember', users);     
    }); 
    // the client emits this when they want to send a message
    socket.on('message', function(message){
        // process an incoming message (don't forget to broadcast it to everyone!)

        // note that you somehow need to determine what room this is in
        // io.of(namespace).adapter.rooms[socket.id] may be of some help, or you
        // could consider adding another custom property to the socket object.

        // Note that io.sockets.adapter.sids is a hash mapping
        // from room name to true for all rooms that the socket is in.
        // The first member of the list is always the socket itself,
        // and each successive element is a room the socket is in,
        // So, to get the room name without adding another custom property,
        // you could do something like this:
        
        var roomName = Object.keys(io.sockets.adapter.sids[socket.id])[1];
        var nickname = socket.nickname; 
        var sql_insert = 'INSERT INTO messages VALUES ($1, $2, $3, $4,$5)'; 
    	conn.query(sql_insert, [,roomName, nickname,message, null]); 
    	io.sockets.in(roomName).emit('message', nickname, message);
    }); 
    
    socket.on('getRooms', function(callback){
        var test_array = Array.from(test_set); 
        callback(test_array); 
    }); 
    
    socket.on('disconnect', function(){
        var clients_in_the_room = io.sockets.in(socket.roomname); 
        var users = [];
        var remainingRoomName; 
        var disconnectedRoomName = socket.roomname; 
        for (var s in clients_in_the_room.connected){
            var client_nickname = io.sockets.connected[s].nickname;
            remainingRoomName = io.sockets.connected[s].roomname; 
            if(remainingRoomName==disconnectedRoomName){
                if(client_nickname!=undefined){
                    users.push(client_nickname); 
                } 
            }
        }

        if(!users.length) {
            test_set.delete(disconnectedRoomName); 
        }
        io.sockets.in(socket.roomname).emit('newMember', users);             
    });
});

/*app.post('/:roomName/messages', function(request, response){
    var name = request.params.roomName;   // 'ABC123'
    var nickname = request.body.nickname; // 'Trump'
    var message = request.body.message;   // 'The beauty of me is that Im very rich' 
    var sql_insert = 'INSERT INTO messages VALUES ($1, $2, $3, $4,$5)'; 
    conn.query(sql_insert, [,name, nickname,message, null]); 
    response.redirect('/' + request.params.roomName);
}); */

/*var messages = [];
var old_id = -1; 
app.get('/:roomName/messages.json', function(request, response){
    //{nickname: 'Trump', body: 'Good people don't go into politics!'}, ...
    var room_name = request.params.roomName; 
	var sql = 'SELECT id, nickname, body FROM messages WHERE room='+'"'+room_name+'"';
	var q = conn.query(sql, function(err,result){
		if(result.rows.length!=0){
			var row = result.rows[result.rows.length-1]; 
			var item = {
			id: row.id, 
			nickname: row.nickname,
			body: row.body 
			}
		}
		if((item!=undefined) && (old_id!=item.id)){
			messages.push(item); 
			old_id = item.id; 
		}
		response.json(messages);
	});
});*/
//error: showing all the rooms that are connected // so after one left it should be free


app.get('*', function(req,res){
 	res.sendFile(path.join(__dirname+'/templates/index.html'));
});

/* List to the port 8080*/
/*app.listen(8080,function(){
	console.log("-Server Listening on port 8080"); 

}); */
server.listen(8080); 

function generateRoomIdentifier() {
   var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
   var result = '';
   for (var i = 0; i < 6; i++)
   	result += chars.charAt(Math.floor(Math.random() * chars.length));
   return result;
}
