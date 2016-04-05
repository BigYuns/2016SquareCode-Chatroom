var express = require('express'), 
	bodyParser = require("body-parser"), 
	anyDB = require('any-db'),
	path    = require("path"),
	engines = require('consolidate'); 



/* Connection to the databse called chatroom.db and create a table*/
var conn = anyDB.createConnection('sqlite3://chatroom.db'); 
/*Q :On the instruction:  Note well that room names must be unique, 
and you will get a database error if you try to reuse one. 
Be sure to handle that error, and generate a new identifier under those circumstances.
A: UNIQUE can be the solution? Or should I handle the situation? */
var sql_create = 'CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, nickname TEXT, body TEXT, time INTEGER )'; 
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

var test_set = new Set();
//var address_set = new Set();  
app.get('/', function(req,res){
	//console.log(__dirname+"/templates/index.html"); 
 	res.render('index.html'); 
});

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


//var users = new Set([]);
//var users=[]; 
io.sockets.on('connection', function(socket){
    // clients emit this when they join new rooms
    socket.on('join', function(roomName, nickname, callback){
    
        socket.join(roomName); // this is a socket.io method
        socket.nickname = nickname; // yay JavaScript! see below
        socket.roomname = roomName; 
        // get a list of messages currently in the room, then send it back
        //users.add(nickname); 

        var clients_in_the_room = io.sockets.in(roomName);
                
        var users = [];
        for (var s in clients_in_the_room.connected){
            var client_nickname = io.sockets.connected[s].nickname;
            if(client_nickname!=undefined){
                users.push(client_nickname); 
            } 
        }
        /*for (var socket in clients_in_the_room.connected) {
                  var client_nickname = io.sockets.connected[socket].nickname;
                  if(client_nickname != undefined) {
                    console.log(client_nickname);
                    users.push(client_nickname);
                  }
                }*/
        //users.push(nickname); 
        //users[nickname] = nickname; 
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
        				//users.add(item.nickname); 
        				//console.log(users); 		
        			}
        		}//for loop
        	}//if statement 
        	callback(messages);
        }); //query function 
    });

    // this gets emitted if a user changes their nickname

    socket.on('changeName', function(changedNickname){
        console.log("changeName is called"); 
        console.log("parameters: "+ changedNickname + " and "+roomName); 
        var oldNickname= socket.nickname; 
        socket.nickname = changedNickname; 
        var roomName = Object.keys(io.sockets.adapter.sids[socket.id])[1];
        var clients_in_the_room = io.sockets.in(roomName);
        var users = [];
        for (var s in clients_in_the_room.connected){
            var client_nickname = io.sockets.connected[s].nickname;
            if(client_nickname!=undefined){
                console.log("clientName: "+ client_nickname);
                users.push(client_nickname); 
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
        //console.log("message is being called"); 
        //console.log(roomName); 
        var nickname = socket.nickname; 
        var sql_insert = 'INSERT INTO messages VALUES ($1, $2, $3, $4,$5)'; 
    	conn.query(sql_insert, [,roomName, nickname,message, null]); 

    	// then send the message to users! 
    	//call the client side event 
    	io.sockets.in(roomName).emit('message', nickname, message);
    }); 
    // the client disconnected/closed their browser window
    socket.on('disconnect', function(socket){
    	console.log("disconnect"); 
        var clients_in_the_room = io.sockets.in(socket.room);
        var users = [];
        var roomName; 
        for (var s in clients_in_the_room.connected){
            var client_nickname = io.sockets.connected[s].nickname;
            roomName =io.sockets.connected[s].roomname; 
            //console.log("roomName: "+ roomName); 
            if(client_nickname!=undefined){
                //console.log("clientName: "+ client_nickname);
                users.push(client_nickname); 
            } 
        }
        io.sockets.in(roomName).emit('newMember', users);         
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


app.get('*', function(req,res){
	//console.log(__dirname+"/templates/index.html"); 
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


/* broadcast changed information*/
function broadcastNickNameChanged(roomName, nickname){
	// send them out
	//nameChange should be defined in the client side 
    io.sockets.in(roomName).emit('nameChange', nickname);
}

function broadcastMemberJoined(roomName, nickname) {
    // send them out
    io.sockets.in(roomName).emit('newMember', nickname);
}