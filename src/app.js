/*
 * TODO:
 *	Represent day/night for each timezone.
 */

// import moment from "moment-timezone";  // For use with RollUp bundler.

const devMode = localStorage.devMode === "1";

const CityStore = (() => {

	const cityZonesMap = new Map();
	let fuse = null;

	fetch("cities.txt")
		.then((response) => response.text())
		.then((content) => {
			const [countriesCSV, citiesCSV] = content.split("\n\n");

			const countries = new Map;
			for (const line of countriesCSV.split("\n")) {
				if (line.length) {
					countries.set(...line.split("\t"));
				}
			}

			cityZonesMap.clear();
			for (const line of citiesCSV.split("\n")) {
				if (line.length) {
					const [name, countryCode, population, timezone] = line.split("\t");
					const country = countries.get(countryCode);
					const item = {name, country, population, timezone, key: countryCode + name};
					cityZonesMap.set(item.key, item);
				}
			}

			fuse = new Fuse(Array.from(cityZonesMap.values()), {
				includeMatches: true,
				keys: [
					{ name: "name", weight: 2 },
					{ name: "country", weight: 1 },
				],
			});

			migrateZoneStorage();

			m.redraw();
		});

	return {
		get data() {
			return cityZonesMap;
		},

		has(key) {
			return cityZonesMap.has(key);
		},

		get(key) {
			return cityZonesMap.get(key);
		},

		search(...args) {
			return fuse === null ? [] : fuse.search(...args);
		},
	};

})();

const model = {
	currentUtc: roundedTo15(moment.utc()),

	cities: loadCities(),

	addCity(city) {
		this.cities.push(city);
		saveCities();
	},

	delCity(key) {
		model.cities.splice(model.cities.indexOf(key), 1);
		console.log(model.cities);
		saveCities();
	},
};

window.addEventListener("load", () => m.mount(document.getElementById("app"), Main));

function Main() {
	// TODO: Move global model here.

	return { view };

	function view() {
		const zoneEls = [
			m(zoneForm, { key: "UTC", timezone: "UTC", currentUtc: model.currentUtc, isDeletable: false }),
		];

		for (const key of model.cities) {
			if (!CityStore.has(key)) {
				zoneEls.push(m("tr", { key }, m("td", { colspan: 3 }, key)));
			} else {
				const { name, country, timezone } = CityStore.get(key);
				zoneEls.push(m(zoneForm, {
					key,
					title: `${name}, ${country}`,
					timezone,
					currentUtc: model.currentUtc,
					isDeletable: true,
				}));
			}
		}

		return [
			m("h1", "~ Timezoner ~"),

			m("table.cities", [
				m("tbody", zoneEls),
				m("tbody", [
					m("tr", m(
						"td",
						{ colspan: 3 },
						m(addCityForm),
					)),
				]),
			]),

			devMode && m("pre", JSON.stringify(model, null, 2)),
		];
	}
}

function zoneForm() {
	return { view };

	function view(vnode) {
		const { key, title, timezone, currentUtc, isDeletable } = vnode.attrs;

		const mt = currentUtc.tz(timezone);
		const [year, month, date, hour, minute, meridian, abbr, offset] =
			mt.format("YYYY MM DD hh mm A zz ZZ").split(" ");

		return m("tr.zone", [
			m("td", isDeletable && m(deleteButton, { onclick() { model.delCity(key) } })),
			m("td.name", [
				m("span", title || timezone),
				title && m("span.subtext", [
					timezone,
					m.trust(" &middot; "),
					abbr + " = UTC" + offset,
				]),
			]),
			m("td", [
				m(numInput, { key, timezone, name: "year", value: year }),
				m("span.sep", { key: "s1" }, m.trust("&ndash;")),
				m(numInput, { key, timezone, name: "month", value: month }),
				m("span.sep", { key: "s2" }, m.trust("&ndash;")),
				m(numInput, { key, timezone, name: "date", value: date }),
				m("span.sep", { key: "s3" }, m.trust("&middot;")),
				m(numInput, { key, timezone, name: "hour", value: hour }),
				m("span.sep", { key: "s4" }, ":"),
				m(numInput, { key, timezone, name: "minute", value: minute }),
				m("span.sep", { key: "s5" }, " "),
				m(numInput, { key, timezone, name: "meridian", value: meridian }),
			]),
		]);
	}
}

function deleteButton() {
	return { view };

	function view(vnode) {
		return m("svg.delete-btn", { onclick: vnode.attrs.onclick }, [
			m("circle", { r: "45%", cx: "50%", cy: "50%" }),
			m("line", { x1: "25%", y1: "50%", x2: "75%", y2: "50%" }),
		]);
	}
}

function numInput(initialVnode) {
	let editingValue = null;
	let { key, name, value, timezone } = initialVnode.attrs;

	return { view };

	function view(vnode) {
		key = vnode.attrs.key;
		name = vnode.attrs.name;
		value = vnode.attrs.value;
		timezone = vnode.attrs.timezone;

		return m("input.num", {
			required: true,
			name,
			value: editingValue || value,
			oninput,
			onblur: stopEditing,
			onkeydown,
			onwheel,
		});
	}

	function oninput(event) {
		editingValue = event.target.value;
		model.currentUtc = model.currentUtc.tz(timezone).set(name, event.target.value).utc();
	}

	function stopEditing() {
		editingValue = null;
	}

	function onkeydown(event) {
		if (event.key === "ArrowUp" || event.key === "ArrowDown") {
			event.preventDefault();
			stopEditing();
			modify(name, event.key.endsWith("Up") ? 1 : -1);

		} else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
			const point = event.target.selectionStart;
			if (point === 0 && event.key === "ArrowLeft") {
				let dst = event.target.previousElementSibling;
				while (dst && dst.previousElementSibling && !dst.matches("input.num")) {
					dst = dst.previousElementSibling;
				}
				if (dst) {
					dst.focus();
					dst.selectionStart = dst.value.length;
					event.preventDefault();
					stopEditing();
				}

			} else if (point === event.target.value.length && event.key === "ArrowRight") {
				let dst = event.target.nextElementSibling;
				while (dst && dst.nextElementSibling && !dst.matches("input.num")) {
					dst = dst.nextElementSibling;
				}
				if (dst) {
					dst.focus();
					dst.selectionEnd = 0;
					event.preventDefault();
					stopEditing();
				}

			}

		}
	}

	function onwheel(event) {
		event.preventDefault();
		stopEditing();
		// FIXME: The event signs are reversed when using a wheel or a touchpad for scrolling.
		modify(name, -Math.sign(event.deltaY));
	}
}

function addCityForm() {
	let searchQuery = "";
	const searchResults = [];
	let prevNeedle = "";
	let searchId = 0;
	let searchSelectedIndex = 0;

	return { view };

	function view() {
		return m("form.zone", { style: { position: "relative" } }, [
			m("input.zone-input.name", {
				placeholder: "Add city",
				value: searchQuery,
				onkeydown,
				oninput,
			}),
			m("div.search-results-box", searchResults.map(({ item }, index) => {
				return m(
					"a",
					{
						href: "#",
						class: index === searchSelectedIndex ? "active" : "",
						onclick: addSelectedZone,
					},
					[item.name, ", ", item.country]
				);
			})),
		]);
	}

	function addSelectedZone(event) {
		if (event && event.preventDefault) {
			event.preventDefault();
		}
		if (searchResults.length > 0) {
			const { item } = searchResults[searchSelectedIndex];
			model.addCity(item.key);
			searchResults.splice(0, searchResults.length);
			searchQuery = "";
		}
	}

	function oninput(event) {
		searchQuery = event.target.value;
	}

	function onkeydown(event) {
		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (searchSelectedIndex > 0) {
				--searchSelectedIndex;
			}

		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			if (searchSelectedIndex < searchResults.length - 1) {
				++searchSelectedIndex;
			}

		} else if (event.key === "Enter") {
			addSelectedZone(event);

		} else if (event.key === "Escape") {
			if (searchQuery) {
				event.preventDefault();
				searchResults.splice(0, searchResults.length);
				searchQuery = "";
			}

		} else {
			setTimeout(doSearch);

		}

		function doSearch() {
			const needle = event.target.value.toLowerCase();
			if (prevNeedle === needle) {
				return;
			}

			const thisSearchId = ++searchId;
			const results = CityStore.search(needle).slice(0, 10);
			if (thisSearchId === searchId) {
				searchResults.splice(0, searchResults.length, ...results);
				searchSelectedIndex = 0;
				prevNeedle = needle;
				m.redraw();
			}
		}
	}
}

function modify(name, direction) {
	let count = 1;

	if (name === "meridian") {
		[count, name] = [12, "h"];

	} else if (name === "minute") {
		count = 15;

	} else if (name === "date") {
		name = "d";

	}

	model.currentUtc.add(count * direction, name);
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

function saveCities() {
	localStorage.setItem("cities", JSON.stringify(model.cities));
}

function loadCities() {
	const DEFAULT_CITIES = [
		"INMumbai",
		"USNew York City",
		"GBLondon",
		"NLAmsterdam",
	];

	const citiesData = localStorage.getItem("cities");
	if (!citiesData) {
		return DEFAULT_CITIES;
	}

	const cities = JSON.parse(citiesData);
	if (!cities || !Array.isArray(cities) || cities.length === 0) {
		return DEFAULT_CITIES;
	}

	return cities;
}

function migrateZoneStorage() {
	let zonesData = localStorage.getItem("zones");
	if (!zonesData) {
		return;
	}

	const cities = [];
	const zoneNames = new Set(JSON.parse(zonesData));
	for (const zoneName of zoneNames) {
		for (const [key, { timezone }] of CityStore.data) {
			if (timezone === zoneName) {
				cities.push(key);
				break;
			}
		}
	}

	localStorage.removeItem("zones");
	model.cities = cities;
	saveCities();
}
