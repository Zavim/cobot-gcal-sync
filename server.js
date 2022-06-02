const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const axios = require("axios");
const cron = require("node-cron");

require("isomorphic-fetch");

let now = new Date();
let month = now.getMonth();
month += 1; //months count from zero
let endMonth = month <= 6 ? month + 6 : (month + 6) % 12;
let year = now.getFullYear();
let date = "01";
let endYear = endMonth < month ? year + 1 : year;

const timeMin = new Date(year, (month - 1) % 12, 1).toISOString();
const timeMax = new Date(year, (endMonth - 1) % 12, 1).toISOString();

const monthString =
	month < 10 ? String(month).padStart(2, "0") : month.toString();
const endMonthString =
	endMonth < 10 ? String(endMonth).padStart(2, "0") : endMonth.toString();

let path =
	"/bookings" +
	"?from=" +
	year +
	"-" +
	monthString +
	"-" +
	date +
	" " +
	"00:00 +0000&amp;to=" +
	endYear +
	"-" +
	endMonthString +
	"-" +
	date +
	" " +
	"23:59 +0000";

// If modifying these scopes, delete token.json.
const SCOPES = [
	// 'https://www.googleapis.com/auth/calendar.readonly',
	// 'https://www.googleapis.com/auth/calendar.events',
	"https://www.googleapis.com/auth/calendar",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";
let access_token;

// Load client secrets from a local file.
cron.schedule("* * * * *", function () {
	fs.readFile("credentials.json", (err, content) => {
		if (err) return console.log("Error loading client secret file:", err);
		// Authorize a client with credentials, then call the Google Calendar API.
		authorize(JSON.parse(content), sync);
	});
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
	const { client_secret, client_id, redirect_uris } = credentials.installed;
	const oAuth2Client = new google.auth.OAuth2(
		client_id,
		client_secret,
		redirect_uris[0]
	);

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, (err, token) => {
		if (err) return getAccessToken(oAuth2Client, callback);
		oAuth2Client.setCredentials(JSON.parse(token));
		client_token = JSON.parse(token);
		callback(oAuth2Client);
	});
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: "offline",
		scope: SCOPES,
	});
	console.log("Authorize this app by visiting this url:", authUrl);
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	rl.question("Enter the code from that page here: ", (code) => {
		rl.close();
		oAuth2Client.getToken(code, (err, token) => {
			if (err) return console.error("Error retrieving access token", err);
			oAuth2Client.setCredentials(token);
			// Store the token to disk for later program executions
			fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
				if (err) console.error(err);
				console.log("Token stored to", TOKEN_PATH);
			});
			callback(oAuth2Client);
		});
	});
}

function getCalendar(auth) {
	return google.calendar({ version: "v3", auth });
}

const sync = (auth) => {
	listCobotEvents(auth, path);
	const currentTime = new Date();
	console.log(
		"last sync: " +
			(currentTime.getMonth() + 1) +
			"/" +
			currentTime.getDate() +
			" " +
			currentTime.getHours() +
			":" +
			(currentTime.getMinutes() > 9
				? currentTime.getMinutes()
				: "0" + currentTime.getMinutes())
	);
};

const convertCobotEvent = (auth, event) => {
	const calendar = getCalendar(auth);
	let calendarID = "";
	switch (event.resource_name) {
		case "All-Access Limelight Tour":
			calendarID = "primary";
			break;
		case "Bird of Paradise Conference Room":
			calendarID = "c_3ck9jkluuacqd18hmjnjoo18qs@group.calendar.google.com";
			break;
		case "Hyacinth Conference Room":
			calendarID = "c_94njebe88sbush6mjegt9imhck@group.calendar.google.com";
			break;
		case "Poppy Conference Room":
			calendarID = "c_5l5dg64g75e05nsbur0t0mfsv4@group.calendar.google.com";
			break;
		case "Zinnia Conference Room":
			calendarID = "c_uvapg2vndbsh20nof4ttclr1no@group.calendar.google.com";
			break;
		default:
			calendarID = "primary";
			break;
	}

	//check for duplicate before insertion
	calendar.events.get(
		{
			calendarId: calendarID,
			eventId: event.id,
		},
		(err, res) => {
			if (err.code === 404) {
				let eventTimeStart = event.from.split(" ");
				let eventYearStart = eventTimeStart[0].slice(0, 4);
				let eventMonthStart = eventTimeStart[0].slice(5, 7);
				let eventDateStart = eventTimeStart[0].slice(-2);
				let eventHourStart = eventTimeStart[1].slice(0, 2);
				let eventMinuteStart = eventTimeStart[1].slice(3, 5);

				let eventTimeEnd = event.to.split(" ");
				let eventYearEnd = eventTimeEnd[0].slice(0, 4);
				let eventMonthEnd = eventTimeEnd[0].slice(5, 7);
				let eventDateEnd = eventTimeEnd[0].slice(-2);
				let eventHourEnd = eventTimeEnd[1].slice(0, 2);
				let eventMinuteEnd = eventTimeEnd[1].slice(3, 5);

				let UTCStart = new Date(
					Date.UTC(
						eventYearStart,
						eventMonthStart,
						eventDateStart,
						eventHourStart,
						eventMinuteStart
					)
				);
				let UTCEnd = new Date(
					Date.UTC(
						eventYearEnd,
						eventMonthEnd,
						eventDateEnd,
						eventHourEnd,
						eventMinuteEnd
					)
				);

				let correctedDateStart = new Date(UTCStart).toString().split(" ");
				let correctedDateEnd = new Date(UTCEnd).toString().split(" ");
				let startTime = "";
				let startYear = correctedDateStart[3];
				let startMonth = eventMonthStart;

				let startDate = correctedDateStart[2];
				let startClock = correctedDateStart[4];
				startTime +=
					startYear + "-" + startMonth + "-" + startDate + "T" + startClock;

				let endTime = "";
				let endYear = correctedDateEnd[3];
				let endMonth = eventMonthEnd;
				let endDate = correctedDateEnd[2];
				let endClock = correctedDateEnd[4];
				endTime += endYear + "-" + endMonth + "-" + endDate + "T" + endClock;

				let memberName = "";
				if (event.membership) {
					const { membership: { name = "" } = {} } = event; //destructuring nested name value in membership obj
					memberName += name;
				}
				createEvent(auth, event, startTime, endTime, calendarID, memberName);
			}
		}
	);
};

const listCobotEvents = (auth, path) => {
	fetch(`https://limelight-tremont.cobot.me/api` + path, {
		method: "GET",
		mode: "same-origin",
		headers: {
			Authorization:
				"Bearer 1efee73ee170f5144b41dfe605e76a6bfc5b7c387c3c7351777aabc7ec8c1f56",
		},
	})
		.then((response) => response.json())
		.then((limelightEvents) => {
			limelightEvents.forEach((event) => {
				convertCobotEvent(auth, event);
			});
		})
		.catch((error) => {
			console.error(error);
		});
};

/**
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

function createEventParameters(calendarId, timeMin, timeMax) {
	const eventParameters = {
		calendarId: calendarId,
		timeMin: timeMin,
		timeMax: timeMax,
		showDeleted: false,
		singleEvents: true,
		orderBy: "startTime",
	};
	return eventParameters;
}

function getActionFromUser(auth) {
	const numberOfListedEvents = 100;
	console.log(
		`10 - Lists your ${numberOfListedEvents} first Google calendar events`
	);
	// console.log(`11 - Lists your ${numberOfListedEvents} first Google calendar events from Today`)
	console.log("20 - Inserts new event for tomorrow");
	console.log("30 - Update the first event to current day");
	console.log("40 - Delete first event");
	console.log("41 - Delete first event from today");
	console.log("90 - Print Auth");
	console.log("666 - Revoke your token");
	console.log("\n0 - Exit");
	console.log("\n");
	console.log("Choose an action:");

	stdin.addListener("data", function (d) {
		switch (Number(d)) {
			case 10:
				listEvents(auth, numberOfListedEvents);
				break;
			// case 11:
			//   listEvents(auth, numberOfListedEvents)
			//   break
			case 20:
				createEvent(auth);
				break;
			case 30:
				updateEvent(auth);
				break;
			case 40:
				deleteFirstEvent(auth);
				break;
			case 41:
				deleteFirstEvent(auth, true);
				break;
			case 90:
				printAuth(auth);
				break;
			case 666:
				revokeToken(auth);
				break;
			case 0:
				process.exit();
		}
	});
}

function printAuth(calendar) {
	// console.log('- Auth: ', auth)
	// const calendar = getCalendar(auth)
	console.log("\n\n\n");
	console.log(calendar._options.auth.credentials.access_token);
}

function deleteFirstEvent(auth, fromToday) {
	const calendar = getCalendar(auth);
	let isoDate;
	fromToday
		? (isoDate = new Date().toISOString())
		: (isoDate = new Date(1970, 1, 1).toISOString());

	calendar.events.list(createEventParameters(isoDate, 1), (err, res) => {
		if (err) console.log(err);

		const { items } = res.data;
		if (items.length) {
			res.data.items.map((event, i) => {
				const start = event.start.dateTime || event.start.date;
				console.log(
					`${start.slice(0, 10)} at ${start.slice(11, 16)} - ${event.summary}`
				);
			});

			// console.log(items[0].id)
			deleteEvent(auth, items[0].id);
		} else {
			console.log("No events found");
		}
	});
}

function createEvent(auth, event, startTime, endTime, calendarId, memberName) {
	const calendar = getCalendar(auth);
	let bookedByString = memberName ? "Booked by " + memberName + " " : "";

	let eventToPost = {
		summary: event.title ? event.title : "Cobot Calendar Event",
		description: event.comments
			? bookedByString + event.comments
			: bookedByString + "",
		start: {
			dateTime: startTime,
			timeZone: "America/New_York",
		},
		end: {
			dateTime: endTime,
			timeZone: "America/New_York",
		},
		calendarId: calendarId,
		id: event.id,
	};

	calendar.events.insert(
		{
			auth: auth,
			calendarId: calendarId,
			resource: eventToPost,
		},
		(err, res) => {
			if (err) console.log(err);
			const event = res.data;

			if (event) {
				console.log(
					"event synced: " + eventToPost.summary + " @",
					startTime,
					endTime
				);
			}
		}
	);
}

function updateEvent(auth) {
	const calendar = google.calendar({ version: "v3", auth });

	const calendarId = "primary";
	let eventId = "";

	let event = {};

	calendar.events.list(
		createEventParameters(new Date(1970, 1, 1).toISOString(), 1),
		(err, res) => {
			if (err) console.log(err);

			const { items } = res.data;

			eventId = items[items.length - 1].id;

			event = items[items.length - 1];

			let today = new Date();
			let todayOneHourAfter = new Date(today.getTime());
			todayOneHourAfter.setHours(todayOneHourAfter.getHours() + 1);

			(event.start.dateTime = today),
				(event.end.dateTime = todayOneHourAfter),
				calendar.events.update(
					{
						auth,
						calendarId,
						eventId,
						resource: event,
					},
					(err, res) => {
						if (err) return console.log(err);
						const event = res.data;

						if (event) {
							console.log("Booked event:");
							console.log(event);
						}
					}
				);
		}
	);
}

function deleteEvent(auth, evId) {
	const calendar = google.calendar({ version: "v3", auth });

	calendar.events.delete(
		{
			auth: auth,
			calendarId: "primary",
			eventId: evId,
		},
		(err, res) => {
			if (err) return console.log(err);
			if (res) {
				console.log("Event deleted!");
			}
		}
	);
}

function revokeToken() {
	axios
		.post(
			`https://accounts.google.com/o/oauth2/revoke?token=${client_token.access_token}`,
			{}
		)
		.then((res) => {
			console.log(
				"status: ",
				res.response.status,
				"response: ",
				res.response.statusText
			);
		})
		.catch((err) => {
			console.log("Access Token error: ", err.response.data);
		});

	axios
		.post(
			`https://accounts.google.com/o/oauth2/revoke?token=${client_token.refresh_token}`,
			{}
		)
		.then((res) => {
			console.log(
				"status: ",
				res.response.status,
				"response: ",
				res.response.statusText
			);
		})
		.catch((err) => {
			console.log("Refresh Token error: ", err.response.data);
		});
}
