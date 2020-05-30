window.onload = main;

let h; // Set to `hyperapp.h` when hyperapp is loaded.

function main() {
	h = hyperapp.h;

	const {app} = hyperapp;

	window.ha = app({

		init: [
			{
				currentUtc: null,

				cities: [
					"Mumbai",
					"London",
					"New York",
					"Sydney",
				],

				// Zone objects by city, data loaded on app start.
				zonesByCity: new Map(),

				timesByZone: new Map(),

				inputValue: "",
			},
			[loadCities/*, options*/],
		],

		node: document.getElementById("app"),

		view(state) {
			return h("div", {}, [
				h("h1", {}, "~ Timezoner ~ "),
				h("section", {}, [
					h("div", {}, zoneDisplayForCity(state)),
					h("input", {
						value: state.inputValue,
						onkeydown: (state, event) => {
							return event.key === "Enter" ? add(state) : state;
						},
						oninput: ((state, event) => {
							return {...state, inputValue: event.target.value};
						}),
					}),
					h("button", {onclick: add}, "add"),
				]),
			]);
		},

	});

	function add(state) {
		if (state.inputValue !== "") {
			return {
				...state,
				cities: [...state.cities, state.inputValue],
				inputValue: "",
			};
		}
		return state;
	}

}

function loadCities(dispatch/*, options*/) {
	fetch('cities5000.txt')
		.then((response) => response.text())
		.then((content) => {
			const zonesByCity = new Map;
			const lines = content.split('\n').slice(2);
			for (const line of lines) {
				if (line) {
					const [name, asciiName, timezone] = line.split("\t");
					zonesByCity.set(name, {name, asciiName, timezone, lowerName: asciiName.toLowerCase()});
				}
			}
			dispatch((state) => {
				return {...state, zonesByCity};
			});
		});
}

function zoneDisplayForCity(state) {
	return state.cities.map((name) => {
		const zone = state.zonesByCity.get(name);
		if (!zone) {
			return "";
		}

		const time = state.timesByZone.get(zone.timezones);

		return h("form", {class: "zone", "data-zone": zone.timezone}, [
			h("div", {class: "name"}, name),
			" - ",
			zone ? zone.timezone : "No zone",
			" - ",
			h("input", {class: "num", required: true, name: "year", value: time.year}),
			"-",
			h("input", {class: "num", required: true, name: "month", value: time.month}),
			"-",
			h("input", {class: "num", required: true, name: "date", value: time.date}),
			"  ",
			h("input", {class: "num", required: true, name: "hour", value: time.hour}),
			":",
			h("input", {class: "num", required: true, name: "minute", value: time.minute}),
			" ",
			h("input", {class: "num", required: true, name: "meridian", value: time.meridian}),
		]);
	});
}
