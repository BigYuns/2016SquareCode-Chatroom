var socket = io.connect();
window.addEventListener('load', function(){
	var hidden = document.getElementById('nicknameField'); 
	//var input_nickname = window.prompt("What is your nickname?");
	//hidden.value = input_nickname;
  var messageForm = document.getElementById('messageForm');

  /*messageForm.addEventListener('submit', sendMessage, false);
  //show the message in five seconds
  setInterval(printResult, 3000);*/
  
  // handle incoming messages
  socket.on('message', function(nickname, message){
    // display a newly-arrived message 
    var space = document.getElementById('message'); 
    space.innerHTML += nickname+ ":  "+ message+ "<br>"; 
  });

  // handle room membership changes
  // you may want to consider having separate handlers for members joining, leaving, and changing their nickname
  /*socket.on('membershipChanged', function(members){
    // display the new member list
  });*/

  //1.new member join
  socket.on('newMember', function(nicknames){
    var user_list = document.getElementById('users'); 
    user_list.innerHTML = " "; 
    for(var i = 0 ; i<nicknames.length; i++){
      user_list.innerHTML +=nicknames[i]+"<br>"; 
    }
  });
  // get the nickname
  var nickname = prompt('Enter a nickname:');
  hidden.value = nickname;

  // join the room
  socket.emit('join', meta('roomName'), nickname, function(messages){
    for(var i =0; i<messages.length; i++){
      var space = document.getElementById('message'); 
      space.innerHTML += messages[i].nickname+ ":  "+ messages[i].body+ "<br>"; 
    }
  });
  //should be the form name 
  var newNicknameForm = document.getElementById('nicknameChange'); 
  if(newNicknameForm!=null){
    newNicknameForm.addEventListener('submit',changeNickName, false); 
  }
  messageForm.addEventListener('submit', sendMessage, false);
}, false);

//change the user: send data from the browser to the server 
function changeNickName(e){
 e.preventDefault();
 var changedNickname = document.getElementById('changedNicknameField').value; 
 socket.emit('changeName',changedNickname); 
}

function meta(name) {
  var tag = document.querySelector('meta[name=' + name + ']');
  if (tag != null)
    return tag.content;
  return '';
}

function sendMessage(e) {
  // prevent the page from redirecting
  e.preventDefault();
  // get the parameters
  //var nickname =document.getElementById('nicknameField').value; // get nickname 
  var message = document.getElementById('messageField').value; // get message 
  //var post_string = "nickname=" + nickname + "&message=" + message;
  socket.emit('message', message); 
  document.getElementById('messageField').value=" "; 
  // send it to the server
 /* var req = new XMLHttpRequest();
  req.open('POST', '/' + meta('roomName') + '/messages', true);
  req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  req.send(post_string);
  document.getElementById('messageField').value =""; */
} 

 
/*function printResult() {
   $.ajax(
   	{ url: '/'+ meta('roomName')+'/messages.json',
      context: document.body,
      success: function(data, textStatus, jqXHR){
      	var space = document.getElementById('message'); 
      	if(data.length!=0){
      		if(count==0){
      			space.innerHTML += "NICKNAME:" + data[data.length-1].nickname + "<br>"; 
      			count +=1; 
      		}
      		if(data[data.length-1].id!=old_id){
      			space.innerHTML += data[data.length-1].body + "<br>"; 
      			old_id = data[data.length-1].id; 
      		}
      		console.log(textStatus); 
      	}
      	
      },
      error : function(jqXHR, textStatus, errorThrown ) {
      console.log(textStatus);
      console.log(errorThrown);
      var err = jQuery.parseJSON(jqXHR.responseText);
      if(err.error) {
        console.log(err.msg);
        if(err.redirect) {
          document.location.href = "/";
        }
        return;
      	}
      }
   });
} */
