window.onload = main;

let h; // Set to `hyperapp.h` when hyperapp is loaded.

function main() {
	h = hyperapp.h;

	const {app} = hyperapp;

	window.ha = app({

		init: [
			{
				currentUtc: roundedTo15(moment.utc()),

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
	fetch('cities.txt')
		.then((response) => response.text())
		.then((content) => {
			const zonesByCity = new Map;
			const countries = new Map;
			const lines = content.split('\n');
			let readingCountries = true;

			for (const line of lines) {
				if (!line) {
					if (readingCountries) {
						readingCountries = false;
					} else {
						break;
					}
				} else {
					if (readingCountries) {
						const [code, name] = line.split("\t");
						countries.set(code, name);
					} else {
						const [name, asciiName, countryCode, timezone] = line.split("\t");
						zonesByCity.set(name, {
							name,
							asciiName: asciiName || name,
							country: countries.get(countryCode) || countryCode,
							timezone,
							lowerName: asciiName.toLowerCase(),
						});
					}
				}
			}

			console.log(zonesByCity);
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

		const [year, month, date, hour, minute, meridian, abbr, offset] =
			state.currentUtc.tz(zone.timezone).format('YYYY MM DD hh mm A zz ZZ').split(' ');

		return h("form", {class: "zone", "data-zone": zone.timezone}, [
			h("div", {class: "name"}, name),
			" - ",
			zone.timezone,
			" - ",
			zone.country,
			" - ",
			h("input", {class: "num", required: true, name: "year", value: year, onkeydown}),
			"-",
			h("input", {class: "num", required: true, name: "month", value: month, onkeydown}),
			"-",
			h("input", {class: "num", required: true, name: "date", value: date, onkeydown}),
			"  ",
			h("input", {class: "num", required: true, name: "hour", value: hour, onkeydown}),
			":",
			h("input", {class: "num", required: true, name: "minute", value: minute, onkeydown}),
			" ",
			h("input", {class: "num", required: true, name: "meridian", value: meridian, onkeydown}),
			" ",
			abbr + ' = UTC' + offset,
		]);
	});

	function onkeydown(state, event) {
		if (!/^Arrow(Up|Down)$/.exec(event.key)) {
			return;
		}

		event.preventDefault();

		const direction = event.key === "ArrowUp" ? 1 : -1;
		let count = 1;
		let unit = event.target.name;

		if (unit === 'meridian')
			[count, unit] = [12, 'h'];
		else if (unit === 'minute')
			count = 15;
		else if (unit === 'date')
			unit = 'd';

		return {
			...state,
			currentUtc: state.currentUtc.add(direction * count, unit),
		};
	}
}

function roundedTo15(mt) {
	if (mt instanceof moment) {
		const mod = mt.second(0).minute() % 15;
		if (mod >= 8)
			mt.add(15, 'm');
		return mt.subtract(mod, 'm');
	} else {
		mt = Math.round(parseFloat(mt));
		const mod = mt % 15;
		if (mod >= 8)
			mt += 15;
		return mt - mod;
	}
}
