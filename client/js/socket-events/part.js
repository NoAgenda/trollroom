"use strict";

const socket = require("../socket");
const {vueApp} = require("../vue");
const store = require("../store").default;

socket.on("part", function(data) {
	// When parting from the active channel/query, jump to the network's lobby
	if (store.state.activeChannel && store.state.activeChannel.channel.id === data.chan) {
		vueApp.switchToChannel(store.state.activeChannel.network.channels[0]);
	}

	const channel = store.getters.findChannel(data.chan);

	if (channel) {
		channel.network.channels.splice(
			channel.network.channels.findIndex((c) => c.id === data.chan),
			1
		);
	}

	vueApp.synchronizeNotifiedState();
});
