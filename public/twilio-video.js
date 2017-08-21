class TwilioVideoPrototype extends HTMLElement {
  // Fetch the access token from the server
  fetchToken(identity) {
    return fetch('/token?identity=' + identity).then(function(data){
      return data.json();
    });
  }

  // Initialise an access manager with the token, then initialise a conversation
  // client using that access manager and listen for incoming invites.
  connectToRoom(data) {
    var roomName = this.getAttribute('room-name') || 'test';
    console.log('Joining room "' + roomName + '"...');
    var connectOptions = {
      name: roomName,
      logLevel: 'debug'
    };
    // Join the Room with the token from the server and the
    // LocalParticipant's Tracks.
    return Twilio.Video.connect(data.token, connectOptions);
  }

  // Prepare the behaviour for a conversation client when an invite is received.
  addParticipants(room) {
    this.activeRoom = room;

    // Attach LocalParticipant's Tracks, if not already attached.
    if (!this.me.querySelector('video')) {
      this.attachParticipantTracks(room.localParticipant, this.me);
    }

    return room;
  }

  addRoomListeners(room) {
    // Attach the Tracks of the Room's Participants.
    room.participants.forEach(function(participant) {
      console.log('Already in Room: "' + participant.identity + '"');
      this.attachParticipantTracks(participant, this.caller);
    }.bind(this));

    // When a Participant joins the Room, log the event.
    room.on('participantConnected', function(participant) {
      console.log('Joining: "' + participant.identity + '"');
    });

    // When a Participant adds a Track, attach it to the DOM.
    room.on('trackAdded', function(track, participant) {
      console.log(participant.identity + ' added track: ' + track.kind);
      this.attachTracks([track], this.caller);
    }.bind(this));

    // When a Participant removes a Track, detach it from the DOM.
    room.on('trackRemoved', function(track, participant) {
      console.log(participant.identity + ' removed track: ' + track.kind);
      this.detachTracks([track]);
    }.bind(this));

    // When a Participant leaves the Room, detach its Tracks.
    room.on('participantDisconnected', function(participant) {
      console.log('Participant "' + participant.identity + '" left the room');
      this.detachParticipantTracks(participant);
    }.bind(this));

    // Once the LocalParticipant leaves the room, detach the Tracks
    // of all Participants, including that of the LocalParticipant.
    room.on('disconnected', function() {
      console.log('Left');
      this.detachParticipantTracks(room.localParticipant);
      room.participants.forEach(this.detachParticipantTracks.bind(this));
      this.activeRoom = null;
    }.bind(this));
    // this.conversationsClient.on('invite', this.inviteReceived.bind(this));

    return room;
  }

  // Attach the Tracks to the DOM.
  attachTracks(tracks, container) {
    tracks.forEach(function(track) {
      container.appendChild(track.attach());
    });
  }

  // Attach the Participant's Tracks to the DOM.
  attachParticipantTracks(participant, container) {
    var tracks = Array.from(participant.tracks.values());
    this.attachTracks(tracks, container);
  }

  // Detach the Tracks from the DOM.
  detachTracks(tracks) {
    tracks.forEach(function(track) {
      track.detach().forEach(function(detachedElement) {
        detachedElement.remove();
      });
    });
  }

  // Detach the Participant's Tracks from the DOM.
  detachParticipantTracks(participant) {
    var tracks = Array.from(participant.tracks.values());
    this.detachTracks(tracks);
  }

  // When a participant joins the conversation, add their media stream to the
  // page.
  participantConnected(participant) {
    participant.media.attach(this.caller);
  }

  // Hang up the current conversation.
  disconnect() {
    if(this.activeRoom){
      this.activeRoom.disconnect();
    }
    this.leave.classList.add('hidden');
    this.enter.classList.remove('hidden');
  }

  connectedCallback() {
    // Grab the template, clone it and attach it to the shadow root
    var importDoc = document.currentScript.ownerDocument;
    var template = importDoc.getElementById('twilio-video-template');
    var clone = importDoc.importNode(template.content, true);
    var shadowRoot = this.createShadowRoot();
    shadowRoot.appendChild(clone);

    // Grab the HTML elements we need to refer to later.
    // me is the placeholder for the local media stream.
    this.me = shadowRoot.getElementById('me');
    // caller is the placeholder for the remote media stream.
    this.caller = shadowRoot.getElementById('caller');
    // chat is the whole chat element including videos and hangup button.
    this.chat = shadowRoot.getElementById('picture-in-picture');
    // leave is a button that can be used to end conversations
    this.leave = shadowRoot.getElementById('leave');
    this.leave.classList.add('hidden');
    // hangup is a button that can be used to end conversations
    this.enter = shadowRoot.getElementById('enter');
    this.enter.addEventListener('click', this.enterRoom.bind(this));
    this.leave.addEventListener('click', this.disconnect.bind(this));
  }

  enterRoom() {
    // Get the identity from the custom element's attribute
    var identity = this.getAttribute('identity') ||
      generateRandomIdentity() ||
      'example';

    this.leave.classList.remove('hidden');
    this.enter.classList.add('hidden');

    // Start the process by fetching the token from the server and setting up
    // the conversation client.
    this.fetchToken(identity).
      then(this.connectToRoom.bind(this)).
      then(this.addParticipants.bind(this)).
      then(this.addRoomListeners.bind(this)).
      catch(function(err) {
        console.trace(err);
      });
  }

  // When the <twilio-video> element is removed from the page, this will be
  // called. We use the opportunity to hang up any current calls and stop the
  // conversation client from listening for incoming invites.
  disconnectedCallback () {
    this.disconnect();
    this.conversationsClient.unlisten();
  }
};
window.customElements.define('twilio-video', TwilioVideoPrototype);
