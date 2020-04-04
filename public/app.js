;
jQuery(function($){
    'use strict';

    /**
     * All the code relevant to Socket.IO is collected in the IO namespace.
     *
     * @type {{init: Function, bindEvents: Function, onConnected: Function, onNewGameCreated: Function, playerJoinedRoom: Function, beginNewGame: Function, onNewWordData: Function, hostCheckAnswer: Function, gameOver: Function, error: Function}}
     */
    var IO = {

        /**
         * This is called when the page is displayed. It connects the Socket.IO client
         * to the Socket.IO server
         */
        init: function() {
            IO.socket = io.connect();
            IO.bindEvents();
        },

        /**
         * While connected, Socket.IO will listen to the following events emitted
         * by the Socket.IO server, then run the appropriate function.
         */
        bindEvents : function() {
            IO.socket.on('connected', IO.onConnected );
            IO.socket.on('newGameCreated', IO.onNewGameCreated );
            IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom );
            IO.socket.on('beginNewGame', IO.beginNewGame );
            IO.socket.on('secretAgent', IO.secretAgent );
            IO.socket.on('givenPlayers', IO.givenPlayers );
            IO.socket.on('newWordData', IO.onNewWordData);
            IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
            IO.socket.on('gameOver', IO.gameOver);
            IO.socket.on('error', IO.error );
            IO.socket.on('showLeader',IO.showLeader);
        },

        /**
         * The client is successfully connected!
         */
        onConnected : function() {
            // Cache a copy of the client's socket.IO session ID on the App
            App.mySocketId = IO.socket.socket.sessionid;
            // console.log(data.message);
        },

        //function for showing leader
        showLeader : function(data){
          App.$gameArea.html(App.$leaderGame);
            var table='<div id="tablearea"><table id="leadertable"><tr><th>Player Name</th><th>Total Win</th></tr>';
            console.log("Showing Leader");
            var i=Object.keys(data).length;
            for(var j=0;j<i;j++)
            {
                //console.log(i);
              table+='<tr><td>'+data[j].name+'</td><td>'+data[j].win+'</td></tr>';
            }
            table+='</table></div>';
            table+="<div id='mid'><button id='back' class='btn'>BACK</button></div>"
            console.log(table);
            App.$gameArea.append(table);
        },

        /**
         * A new game has been created and a random game ID has been generated.
         * @param data {{ gameId: int, mySocketId: * }}
         */
        onNewGameCreated : function(data) {
            App.Host.gameInit(data);
        },

        /**
         * A player has successfully joined the game.
         * @param data {{playerName: string, gameId: int, mySocketId: int}}
         */
        playerJoinedRoom : function(data) {
            // When a player joins a room, do the updateWaitingScreen funciton.
            // There are two versions of this function: one for the 'host' and
            // another for the 'player'.
            //
            // So on the 'host' browser window, the App.Host.updateWiatingScreen function is called.
            // And on the player's browser, App.Player.updateWaitingScreen is called.
            App[App.myRole].updateWaitingScreen(data);
        },

        /**
         * Both players have joined the game.
         * @param data
         */
        beginNewGame : function(data) {
            App[App.myRole].gameCountdown(data);
        },

        secretAgent : function(name) {
            if(App.myRole === 'Player'){
                App.Player.assignSecret(name);
            }
        },

        givenPlayers : function(players) {
            if(App.myRole === 'Player'){
                App.Player.players = players;
            }
        },

        /**
         * A new set of words for the round is returned from the server.
         * @param data
         */
        onNewWordData : function(data) {
            // Update the current round
            App.currentRound = data.round;

            // Change the word for the Host and Player
            App[App.myRole].newWord(data);
        },

        /**
         * A player answered. If this is the host, check the answer.
         * @param data
         */
        hostCheckAnswer : function(data) {
            App[App.myRole].checkAnswer(data);
        },

        /**
         * Let everyone know the game has ended.
         * @param data
         */
        gameOver : function(data) {
            App[App.myRole].endGame(data);
        },

        /**
         * An error has occurred.
         * @param data
         */
        error : function(data) {
            alert(data.message);
        }

    };

    var App = {

        /**
         * Keep track of the gameId, which is identical to the ID
         * of the Socket.IO Room used for the players and host to communicate
         *
         */
        gameId: 0,

        /**
         * This is used to differentiate between 'Host' and 'Player' browsers.
         */
        myRole: '',   // 'Player' or 'Host'

        /**
         * The Socket.IO socket object identifier. This is unique for
         * each player and host. It is generated when the browser initially
         * connects to the server when the page loads for the first time.
         */
        mySocketId: '',

        /**
         * Identifies the current round. Starts at 0 because it corresponds
         * to the array of word data stored on the server.
         */
        currentRound: 0,

        /* *************************************
         *                Setup                *
         * *********************************** */

        /**
         * This runs when the page initially loads.
         */
        init: function () {
            App.cacheElements();
            App.showInitScreen();
            App.bindEvents();

            // Initialize the fastclick library
            FastClick.attach(document.body);
        },

        /**
         * Create references to on-screen elements used throughout the game.
         */
        cacheElements: function () {
            App.$doc = $(document);

            // Templates
            App.$gameArea = $('#gameArea');
            App.$templateIntroScreen = $('#intro-screen-template').html();
            App.$templateNewGame = $('#create-game-template').html();
            App.$templateJoinGame = $('#join-game-template').html();
            App.$hostGame = $('#host-game-template').html();
            App.$leaderGame = $('#leaderboard-template').html();
        },

        /**
         * Create some click handlers for the various buttons that appear on-screen.
         */
        bindEvents: function () {
            // Host
            App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);
            App.$doc.on('click', '#btnStartGame', App.Host.startGame);
            App.$doc.on('click', '#btnHostRestart', App.Host.restartGame);
            

            // Player
            App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
            App.$doc.on('click', '#btnStart',App.Player.onPlayerStartClick);
            App.$doc.on('click', '.btnAnswer',App.Player.onPlayerAnswerClick);
            App.$doc.on('click', '#leaderboard', App.onLeaderboardClick);
            App.$doc.on('click', '#back', App.onBackClick);
        },

        /* *************************************
         *             Game Logic              *
         * *********************************** */

        /**
         * Show the initial Anagrammatix Title Screen
         * (with Start and Join buttons)
         */
        showInitScreen: function() {
            App.$gameArea.html(App.$templateIntroScreen);
            App.doTextFit($('.title'));
        },

        onLeaderboardClick : function(){
          console.log("clicked button");
          IO.socket.emit('findLeader');
        },

        onBackClick : function()
        {
          App.$gameArea.html(App.$templateIntroScreen);
          App.doTextFit($('.title'));
        },
        /* *******************************
           *         HOST CODE           *
           ******************************* */
        Host : {

            /**
             * Contains references to player data
             */
            players : [],

            /**
             * Flag to indicate if a new game is starting.
             * This is used after the first game ends, and players initiate a new game
             * without refreshing the browser windows.
             */
            isNewGame : false,

            /**
             * Keep track of the number of players that have joined the game.
             */
            numPlayersInRoom: 0,

            /**
             * A reference to the correct answer for the current round.
             */
            currentAgent: '',

            /**
             * Handler for the "Start" button on the Title Screen.
             */
            onCreateClick: function () {
                // console.log('Clicked "Create A Game"');
                IO.socket.emit('hostCreateNewGame');
            },

            /**
             * The Host screen is displayed for the first time.
             * @param data{{ gameId: int, mySocketId: * }}
             */
            gameInit: function (data) {
                App.gameId = data.gameId;
                App.mySocketId = data.mySocketId;
                App.myRole = 'Host';
                App.Host.numPlayersInRoom = 0;

                App.Host.displayNewGameScreen();
                // console.log("Game started with ID: " + App.gameId + ' by host: ' + App.mySocketId);
            },

            /**
             * Show the Host screen containing the game URL and unique game ID
             */
            displayNewGameScreen : function() {
                // Fill the game screen with the appropriate HTML
                App.$gameArea.html(App.$templateNewGame);

                // Display the URL on screen
                $('#gameURL').text(window.location.href);
                App.doTextFit($('#gameURL'));

                // Show the gameId / room id on screen
                $('#spanNewGameCode').text(App.gameId);
            },

            /**
             * Update the Host screen when the first player joins
             * @param data{{playerName: string}}
             */
            updateWaitingScreen: function(data) {
                // If this is a restarted game, show the screen.
                if ( App.Host.isNewGame ) {
                    App.Host.displayNewGameScreen();
                }
                // Update host screen
                $('#playersWaiting')
                    .append('<p/>')
                    .text('Player ' + data.playerName + ' joined the game.');

                // Store the new player's data on the Host.
                data.vote = ""
                App.Host.players.push(data);

                // Increment the number of players in the room
                App.Host.numPlayersInRoom += 1;

                // // If two players have joined, start the game!
                // if (App.Host.numPlayersInRoom === 2) {
                //     // console.log('Room is full. Almost ready!');
                // }
            },

            /**
             * The Host clicked to start the game
             */
            startGame: function (data) {
                // Let the server know that two players are present.
                console.log("Host starting game")
                IO.socket.emit('hostRoomFull', App.gameId);
            },

            /**
             * Show the countdown screen
             */
            gameCountdown : function() {

                // Prepare the game screen with new HTML
                //TODO change this ui to display all players
                App.$gameArea.html(App.$hostGame);
                App.doTextFit($('#hostWord'));
                $('#roundCount').remove();

                // Begin the on-screen countdown timer
                var $secondsLeft = $('#hostWord');
                App.countDown($secondsLeft, 10, function(){
                    IO.socket.emit('hostCountdownFinished', App.gameId);
                });

                //pick a secret agent
                let secret = Math.floor(Math.random() * Math.floor(App.Host.players.length));

                // Display the players' names on screen
                for(var i = 0; i < App.Host.players.length; i++){

                    //display votes
                    if(i % 2 === 0){
                        $('#playerScores').append("<div id='"+App.Host.players[i].playerName+"' class='playerScore player1Score'><span class='score'>0</span><span class='playerName'>"+App.Host.players[i].playerName+"</span></div>")
                    }else{
                        $('#playerScores').append("<div id='"+App.Host.players[i].playerName+"' class='playerScore player2Score'><span class='playerName'>"+App.Host.players[i].playerName+"</span><span class='score'>0</span></div>")
                    }
                    
                    
                    if(i === secret){
                        App.Host.players[i].isSecret = true
                        App.Host.currentAgent = App.Host.players[i].playerName
                        console.log("The secret is " + App.Host.players[i].playerName)
                        IO.socket.emit('hostSecretAssigned', App.gameId, App.Host.players[i].playerName);
                    }

                    IO.socket.emit('hostGivenPlayers', App.gameId, App.Host.players);
                }
                // $('#player1Score')
                //     .find('.playerName')
                //     .html(App.Host.players[0].playerName);

                // $('#player2Score')
                //     .find('.playerName')
                //     .html(App.Host.players[1].playerName);

                // // Set the Score section on screen to 0 for each player.
                // $('#player1Score').find('.score').attr('id',App.Host.players[0].mySocketId);
                // $('#player2Score').find('.score').attr('id',App.Host.players[1].mySocketId);
            },

            /**
             * Show the word for the current round on screen.
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord : function(data) {
                // Insert the new word into the DOM
                // $('#hostWord').text(data.regMsg);
                // App.doTextFit('#hostWord');
                App.Host.currentRound = data.round;

                var $secondsLeft = $('#hostWord');
                App.countDown($secondsLeft, 70, function(){
                    //check votes
                    var voteCounts = {}
                    var highestVote = 0
                    var highestVotePerson = ""

                    for(var i = 0; i < App.Host.players.length; i++){
                        if(App.Host.players[i].vote in voteCounts){
                            voteCounts[App.Host.players[i].vote] += 1
                        }else{
                            voteCounts[App.Host.players[i].vote] = 1
                        }
                    }

                    for(const person in voteCounts){
                        if(voteCounts[person] > highestVote){
                            highestVote = voteCounts[person]
                            highestVotePerson = person
                        }
                    }

                    //if voted majority voted for secret agent end the game
                    if(highestVote >= App.Host.players.length - 1 && highestVotePerson === App.Host.currentAgent){
                        //end game through round limit
                        App.currentRound += 100;
                         var data = {
                            gameId : App.gameId,
                            round : App.currentRound,
                            agentLost : true
                        }
                        IO.socket.emit('hostNextRound',data);
                    }else{
                        //otherwise continue
                         App.currentRound += 1;
                         var data = {
                            gameId : App.gameId,
                            round : App.currentRound,
                            agentLost : false
                        }
                        IO.socket.emit('hostNextRound',data);
                    }                           
                });
            },

            /**
             * Check the answer clicked by a player.
             * @param data{{round: *, playerId: *, answer: *, gameId: *}}
             */
            checkAnswer : function(data) {
                // Verify that the answer clicked is from the current round.
                // This prevents a 'late entry' from a player whos screen has not
                // yet updated to the current round.
                if (data.round === App.currentRound){

                    var playerVoting = App.Host.players.find(({ playerName }) => playerName === data.playerName)
                    if(playerVoting.vote && playerVoting.vote !== ""){
                        var $pScore = $('#' + playerVoting.vote).find('.score');
                        $pScore.text( +$pScore.text() - 1 );
                    }

                    playerVoting.vote = data.answer;
                    var $pScore = $('#' + data.answer).find('.score');
                    $pScore.text( +$pScore.text() + 1 );
                }
            },


            /**
             * All 10 rounds have played out. End the game.
             * @param data
             */
            endGame : function(data) {
                
                // Display the winner (or tie game message)
                if(data.agentLost){
                    $('#hostWord').text("The Secret Agent Was Killed!");
                } else {
                    $('#hostWord').text("The Secret Agent Won!");
                    data.winner=App.Host.currentAgent;
                }
                App.doTextFit($('#hostWord'));
                
                if(data.done>0)
                {

                }
                else data.done=0;
                
                // Reset game data
                // App.Host.numPlayersInRoom = 0;
                // App.Host.isNewGame = true;
                // IO.socket.emit('hostNextRound',data);

                $('#wordArea').append(
                        // Create a button to start a new game.
                        $('<button>Play Again</button>')
                            .attr('id','btnHostRestart')
                            .addClass('btn')
                            .addClass('btnGameOver')
                    )
            },

            /**
             * Host hit the 'Start Again' button after the end of a game.
             */
            restartGame : function() {
                $('#btnHostRestart').remove()

                console.log("restart game")
                App.currentRound = 0

                //pick new secret agent
                let secret = Math.floor(Math.random() * Math.floor(App.Host.players.length));
                App.Host.players[secret].isSecret = true
                App.Host.currentAgent = App.Host.players[secret].playerName
                console.log("The secret is " + App.Host.players[secret].playerName)
                IO.socket.emit('hostSecretAssigned', App.gameId, App.Host.players[secret].playerName);

                //restart
                IO.socket.emit('hostCountdownFinished', App.gameId);
            }
        },


        /* *****************************
           *        PLAYER CODE        *
           ***************************** */

        Player : {

            /**
             * A reference to the socket ID of the Host
             */
            hostSocketId: '',

            /**
             * The player's name entered on the 'Join' screen.
             */
            myName: '',

            isSecret: false,

            players: [],

            assignSecret: function (name) {
                if(App.Player.myName === name){
                    App.Player.isSecret = true;
                }else{
                    App.Player.isSecret = false;
                }
            },


            /**
             * Click handler for the 'JOIN' button
             */
            onJoinClick: function () {
                // console.log('Clicked "Join A Game"');

                // Display the Join Game HTML on the player's screen.
                App.$gameArea.html(App.$templateJoinGame);
            },

            /**
             * The player entered their name and gameId (hopefully)
             * and clicked Start.
             */
            onPlayerStartClick: function() {
                // console.log('Player clicked "Start"');

                // collect data to send to the server
                var data = {
                    gameId : +($('#inputGameId').val()),
                    playerName : $('#inputPlayerName').val() || 'anon',
                    isSecret: false
                };

                // Send the gameId and playerName to the server
                IO.socket.emit('playerJoinGame', data);

                // Set the appropriate properties for the current player.
                App.myRole = 'Player';
                App.Player.myName = data.playerName;
                App.Player.isSecret = data.isSecret;
            },

            /**
             *  Click handler for the Player hitting a word in the word list.
             */
            onPlayerAnswerClick: function() {
                // console.log('Clicked Answer Button');
                var $btn = $(this);      // the tapped button
                var answer = $btn.val(); // The tapped word

                // Send the player info and tapped word to the server so
                // the host can check the answer.
                var data = {
                    gameId: App.gameId,
                    playerId: App.mySocketId,
                    playerName: App.Player.myName,
                    answer: answer,
                    round: App.currentRound
                }
                IO.socket.emit('playerAnswer',data);
            },

            /**
             *  Click handler for the "Start Again" button that appears
             *  when a game is over.
             */
            onPlayerRestart : function() {
                var data = {
                    gameId : App.gameId,
                    playerName : App.Player.myName
                }
                IO.socket.emit('playerRestart',data);
                App.currentRound = 0;
                $('#gameArea').html("<h3>Waiting on host to start new game.</h3>");
            },

            /**
             * Display the waiting screen for player 1
             * @param data
             */
            updateWaitingScreen : function(data) {
                if(IO.socket.socket.sessionid === data.mySocketId){
                    App.myRole = 'Player';
                    App.gameId = data.gameId;

                    $('#playerWaitingMessage')
                        .append('<p/>')
                        .text('Joined Game ' + data.gameId + '. Please wait for game to begin.');
                }
            },

            /**
             * Display 'Get Ready' while the countdown timer ticks down.
             * @param hostData
             */
            gameCountdown : function(hostData) {
                App.Player.hostSocketId = hostData.mySocketId;
                $('#gameArea').html('<div class="gameOver">You will be given a situation and 10 seconds to make a face over video chat. When you hear the beep, come back and vote for who is the secret agent!</div>');
            },

            /**
             * Show the list of words for the current round.
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord : function(data) {
                App.$gameArea.html(App.$hostGame);
                
                if(App.Player.isSecret){
                    $('#wordArea').prepend("<h2 style='color: #fff;'>You are the secret agent!<h2/>")
                    $('#hostWord').text(data.secretMsg);
                    App.doTextFit($('#hostWord'));
                }else{
                    $('#hostWord').text(data.regMsg);
                    App.doTextFit($('#hostWord'));
                }

                $("#faceAudio")[0].play()
                
                // Begin the on-screen countdown timer
                var $secondsLeft = $('#roundCount');
                App.doTextFit($('#roundCount'));
                App.countDown($secondsLeft, 10, function(){
                    //make noise and send to voting screen
                    $("#voteAudio")[0].play()

                    //get vote count
                    var voteCounts = {}
                    for(var i = 0; i < App.Player.players.length; i++){
                        if(App.Player.players[i].vote in voteCounts){
                            voteCounts[App.Player.players[i].vote] += 1
                        }else{
                            voteCounts[App.Player.players[i].vote] = 1
                        }
                    }

                    for(var i = 0; i < App.Player.players.length; i++){
                        //display votes
                        var vote = 0;
                        if(App.Player.players[i].playerName in voteCounts){
                            vote = voteCounts[App.Player.players[i].playerName]
                        }
                        
                        if(i % 2 === 0){
                            $('#playerScores').append("<div id='"+App.Player.players[i].playerName+"' class='playerScore player1Score'><span class='score'>"+vote+"</span><span class='playerName'>"+App.Player.players[i].playerName+"</span></div>")
                        }else{
                            $('#playerScores').append("<div id='"+App.Player.players[i].playerName+"' class='playerScore player2Score'><span class='playerName'>"+App.Player.players[i].playerName+"</span><span class='score'>"+vote+"</span></div>")
                        }
                    }

                    // Create an unordered list element
                    var $list = $('<ul/>').attr('id','ulAnswers');

                    // Insert a list item for each player in the game
                    // received from the server.
                    $.each(App.Player.players, function(){
                        $list                                //  <ul> </ul>
                            .append( $('<li/>')              //  <ul> <li> </li> </ul>
                                .append( $('<button/>')      //  <ul> <li> <button> </button> </li> </ul>
                                    .addClass('btnAnswer')   //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                    .addClass('btn')         //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                    .val(this.playerName)               //  <ul> <li> <button class='btnAnswer' value='word'> </button> </li> </ul>
                                    .html(this.playerName)              //  <ul> <li> <button class='btnAnswer' value='word'>word</button> </li> </ul>
                                )
                            )
                    });

                    // Insert the list onto the screen.
                    $('#gameArea').html($('#playerScores'))
                    $('#gameArea').append($secondsLeft)
                    $('#gameArea').append($list);
                    
                    App.countDown($secondsLeft, 60, function(){
                        //vote countdown
                    })
                });
            },

            /**
             * Check the answer clicked by a player.
             * @param data{{round: *, playerId: *, answer: *, gameId: *}}
             */
            checkAnswer : function(data) {
                // Verify that the answer clicked is from the current round.
                // This prevents a 'late entry' from a player whos screen has not
                // yet updated to the current round.
                if (data.round === App.currentRound){

                    var playerVoting = App.Player.players.find(({ playerName }) => playerName === data.playerName)
                    if(playerVoting.vote && playerVoting.vote !== ""){
                        var $pScore = $('#' + playerVoting.vote).find('.score');
                        $pScore.text( +$pScore.text() - 1 );
                    }

                    playerVoting.vote = data.answer;
                    var $pScore = $('#' + data.answer).find('.score');
                    $pScore.text( +$pScore.text() + 1 );
                }
            },

            /**
             * Show the "Game Over" screen.
             */
            endGame : function(data) {
                if(data.agentLost){
                    $('#gameArea').html('<div class="gameOver">The Secret Agent Was Killed!</div>');
                } else {
                    $('#gameArea').html('<div class="gameOver">The Secret Agent Won!</div>');
                }
            }
        },


        /* **************************
                  UTILITY CODE
           ************************** */

        /**
         * Display the countdown timer on the Host screen
         *
         * @param $el The container element for the countdown timer
         * @param startTime
         * @param callback The function to call when the timer ends.
         */
        countDown : function( $el, startTime, callback) {

            // Display the starting time on the screen.
            $el.text(startTime);
            App.doTextFit($el);

            // console.log('Starting Countdown...');

            // Start a 1 second timer
            var timer = setInterval(countItDown,1000);

            // Decrement the displayed timer value on each 'tick'
            function countItDown(){
                startTime -= 1
                $el.text(startTime);
                App.doTextFit($el);

                if( startTime <= 0 ){
                    // console.log('Countdown Finished.');

                    // Stop the timer and do the callback.
                    clearInterval(timer);
                    callback();
                    return;
                }
            }

        },

        /**
         * Make the text inside the given element as big as possible
         * See: https://github.com/STRML/textFit
         *
         * @param el The parent element of some text
         */
        doTextFit : function(el) {
            textFit(
                el[0],
                {
                    alignHoriz:true,
                    alignVert:false,
                    widthOnly:true,
                    reProcess:true,
                    maxFontSize:250
                }
            );
        }

    };

    IO.init();
    App.init();

}($));
