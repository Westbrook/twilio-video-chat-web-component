var importDoc = document.currentScript.ownerDocument;
var activeRoom;
var previewTracks;
var identity;
var roomName;
// Attach the Tracks to the DOM.
function attachTracks(tracks, container) {
  tracks.forEach(function(track) {
    container.appendChild(track.attach());
  });
}

// Attach the Participant's Tracks to the DOM.
function attachParticipantTracks(participant, container) {
  var tracks = Array.from(participant.tracks.values());
  attachTracks(tracks, container);
}

// Detach the Tracks from the DOM.
function detachTracks(tracks) {
  tracks.forEach(function(track) {
    track.detach().forEach(function(detachedElement) {
      detachedElement.remove();
    });
  });
}

// Detach the Participant's Tracks from the DOM.
function detachParticipantTracks(participant) {
  var tracks = Array.from(participant.tracks.values());
  detachTracks(tracks);
}

class TwilioVideoPrototype extends HTMLElement {
  // Fetch the access token from the server
  fetchToken(identity) {
    return fetch("/token?identity=" + identity).then(function(data){
      return data.json();
    });
  }

  // Initialise an access manager with the token, then initialise a conversation
  // client using that access manager and listen for incoming invites.
  createClient(data) {
    console.log("Joining room '" + "test" + "'...");
    var connectOptions = {
      name: 'test',
      logLevel: 'debug'
    };
    // Join the Room with the token from the server and the
    // LocalParticipant's Tracks.
    return Twilio.Video.connect(data.token, connectOptions);
  }

  // Prepare the behaviour for a conversation client when an invite is received.
  setupClient(room) {
    window.room = activeRoom = room;

    console.log("Joined as '" + identity + "'");
    // document.getElementById('button-join').style.display = 'none';
    // document.getElementById('button-leave').style.display = 'inline';

    // Attach LocalParticipant's Tracks, if not already attached.
    if (!this.me.querySelector('video')) {
      attachParticipantTracks(room.localParticipant, this.me);
    }

    // Attach the Tracks of the Room's Participants.
    room.participants.forEach(function(participant) {
      console.log("Already in Room: '" + participant.identity + "'");
      attachParticipantTracks(participant, this.caller);
    }.bind(this));

    // When a Participant joins the Room, log the event.
    room.on('participantConnected', function(participant) {
      console.log("Joining: '" + participant.identity + "'");
    });

    // When a Participant adds a Track, attach it to the DOM.
    room.on('trackAdded', function(track, participant) {
      console.log(participant.identity + " added track: " + track.kind);
      attachTracks([track], this.caller);
    }.bind(this));

    // When a Participant removes a Track, detach it from the DOM.
    room.on('trackRemoved', function(track, participant) {
      console.log(participant.identity + " removed track: " + track.kind);
      detachTracks([track]);
    });

    // When a Participant leaves the Room, detach its Tracks.
    room.on('participantDisconnected', function(participant) {
      console.log("Participant '" + participant.identity + "' left the room");
      detachParticipantTracks(participant);
    });

    // Once the LocalParticipant leaves the room, detach the Tracks
    // of all Participants, including that of the LocalParticipant.
    room.on('disconnected', function() {
      console.log('Left');
      if (previewTracks) {
        previewTracks.forEach(function(track) {
          track.stop();
        });
      }
      detachParticipantTracks(room.localParticipant);
      room.participants.forEach(detachParticipantTracks);
      activeRoom = null;
    });
    this.hangup.addEventListener("click", this.disconnect.bind(this));
    // this.conversationsClient.on("invite", this.inviteReceived.bind(this));
  }

  // Accept the invite
  inviteReceived(invite) {
    invite.accept().then(this.setupConversation.bind(this));
  }

  // Now a conversation has started show our local video stream and setup
  // listeners for the participant joining. We also handle other conversation
  // lifecycle events here, like when the conversation is disconnected, and
  // when the hangup button is pressed.
  setupConversation(conversation) {
    this.currentConversation = conversation;
    conversation.localMedia.attach(this.me);
    this.chat.classList.remove("hidden");
    this.hangup.addEventListener("click", this.disconnect.bind(this));
    conversation.on("participantConnected", this.participantConnected.bind(this));
    conversation.on("disconnected", this.disconnected.bind(this));
  }

  // When a participant joins the conversation, add their media stream to the
  // page.
  participantConnected(participant) {
    participant.media.attach(this.caller);
  }

  // When the conversation is disconnected, hide the contents and remove
  // the click handler on the hangup button.
  disconnected() {
    this.chat.classList.add("hidden");
    this.currentConversation.localMedia.detach();
    this.hangup.removeEventListener("click", this.disconnect.bind(this));
  }

  // Hang up the current conversation.
  disconnect() {
    if(activeRoom){
      activeRoom.disconnect();
    }
  }

  connectedCallback() {
    // Grab the template, clone it and attach it to the shadow root
    var template = importDoc.getElementById("twilio-video-template");
    var clone = importDoc.importNode(template.content, true);
    var shadowRoot = this.createShadowRoot();
    shadowRoot.appendChild(clone);

    // Grab the HTML elements we need to refer to later.
    // me is the placeholder for the local media stream.
    this.me = shadowRoot.getElementById("me");
    // caller is the placeholder for the remote media stream.
    this.caller = shadowRoot.getElementById("caller");
    // chat is the whole chat element including videos and hangup button.
    this.chat = shadowRoot.getElementById("picture-in-picture");
    // hangup is a button that can be used to end conversations
    this.hangup = shadowRoot.getElementById("hangup");
    // hangup is a button that can be used to end conversations
    this.call = shadowRoot.getElementById("call");
    this.call.addEventListener('click', this.startCall.bind(this));
  }

  startCall() {
    // Get the identity from the custom element's attribute
    var identity = this.getAttribute("identity") || "example";
    // Start the process by fetching the token from the server and setting up
    // the conversation client.
    this.fetchToken(identity).
      then(this.createClient.bind(this)).
      then(this.setupClient.bind(this)).
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
