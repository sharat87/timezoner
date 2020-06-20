/*
 * TODO:
 *	Represent day/night for each timezone.
 */

// import moment from "moment-timezone";  // For use with RollUp bundler.

const devMode = localStorage.devMode === "1";
window.addEventListener("load", start);

const CityStore = (() => {

	let isReady = false;
	const cityZonesMap = new Map();
	let searchId = 0;

	fetch("cities.txt")
		.then((response) => response.text())
		.then((content) => {
			const [countriesCSV, citiesCSV] = content.split("\n\n");

			const countries = new Map;
			for (const line of countriesCSV.split("\n")) {
				if (line.length) {
					countries.set(line.substr(0, 2), line.substr(2));
				}
			}

			cityZonesMap.clear();
			for (const line of citiesCSV.split("\n")) {
				if (line.length) {
					const [name, countryCode, timezone] = line.split("\t");
					const country = countries.get(countryCode);
					let key = countryCode + name;
					cityZonesMap.set(key, { name, country, timezone, key, searchRep: deburr(name).toLowerCase() });
				}
			}

			migrateZoneStorage();
			isReady = true;
		});

	return {
		get isReady() {
			return isReady;
		},

		get data() {
			return cityZonesMap;
		},

		has(key) {
			return cityZonesMap.has(key);
		},

		get(key) {
			return cityZonesMap.get(key);
		},

		search(needle, limit) {
			const thisSearchId = ++searchId;

			return new Promise((resolve, reject) => {
				needle = needle.trim().toLowerCase();

				if (needle.length === 0) {
					resolve([]);
				}

				const prefixMatches = [];
				const anywhereMatches = [];

				for (const item of cityZonesMap.values()) {
					if (item.searchRep.includes(needle)) {
						(item.searchRep.startsWith(needle) ? prefixMatches : anywhereMatches).push({ item });
						if (prefixMatches.length >= limit) {
							break;
						}
					}
					if (thisSearchId !== searchId) {
						reject();
					}
				}

				resolve(prefixMatches.concat(...anywhereMatches).slice(0, limit));
			});
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

function start() {
	m.mount(document.getElementById("app"), Main);
}

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
	let searchSelectedIndex = 0;

	return { view };

	function view() {
		return m("form.zone", { style: { position: "relative" } }, [
			m("input.zone-input.name", {
				placeholder: CityStore.isReady ? "Add city" : "Loading cities...",
				value: searchQuery,
				onkeydown,
				oninput,
			}),
			searchQuery && m(
				"div.search-results-box",
				!CityStore.isReady
					? m.trust("Loading cities for search, please wait&hellip;")
					: searchResults.length === 0
						? "No matches found."
						: searchResults.map(({ item }, index) => {
							return m(
								"a",
								{
									href: "#",
									class: index === searchSelectedIndex ? "active" : "",
									onclick: addSelectedZone,
								},
								`${item.name}, ${item.country}`
							);
						}),
			),
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
		setTimeout(doSearch);
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

		}
	}

	function doSearch() {
		const needle = searchQuery.toLowerCase();
		if (prevNeedle === needle) {
			return;
		}

		CityStore.search(needle, 10)
			.then(results => {
				searchResults.splice(0, searchResults.length, ...results);
				searchSelectedIndex = 0;
				prevNeedle = needle;
				m.redraw();
			})
			.catch(() => console.info("Search rejected for " + needle));
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

const deburr = (() => {
	// Source: <https://github.com/lodash/lodash/blob/4.1.0-npm-packages/lodash.deburr/index.js>.

	/**
	 * lodash (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
	 * Released under MIT license <https://lodash.com/license>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 */

	/** Used to match Latin Unicode letters (excluding mathematical operators). */
	const reLatin = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g;

	/**
	 * Used to match [combining diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks) and
	 * [combining diacritical marks for symbols](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks_for_Symbols).
	 */
	const reComboMark = /\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]/g;

	/** Used to map Latin Unicode letters to basic Latin letters. */
	const deburredLetters = {
		// Latin-1 Supplement block.
		'\xc0': 'A', '\xc1': 'A', '\xc2': 'A', '\xc3': 'A', '\xc4': 'A', '\xc5': 'A',
		'\xe0': 'a', '\xe1': 'a', '\xe2': 'a', '\xe3': 'a', '\xe4': 'a', '\xe5': 'a',
		'\xc7': 'C', '\xe7': 'c',
		'\xd0': 'D', '\xf0': 'd',
		'\xc8': 'E', '\xc9': 'E', '\xca': 'E', '\xcb': 'E',
		'\xe8': 'e', '\xe9': 'e', '\xea': 'e', '\xeb': 'e',
		'\xcc': 'I', '\xcd': 'I', '\xce': 'I', '\xcf': 'I',
		'\xec': 'i', '\xed': 'i', '\xee': 'i', '\xef': 'i',
		'\xd1': 'N', '\xf1': 'n',
		'\xd2': 'O', '\xd3': 'O', '\xd4': 'O', '\xd5': 'O', '\xd6': 'O', '\xd8': 'O',
		'\xf2': 'o', '\xf3': 'o', '\xf4': 'o', '\xf5': 'o', '\xf6': 'o', '\xf8': 'o',
		'\xd9': 'U', '\xda': 'U', '\xdb': 'U', '\xdc': 'U',
		'\xf9': 'u', '\xfa': 'u', '\xfb': 'u', '\xfc': 'u',
		'\xdd': 'Y', '\xfd': 'y', '\xff': 'y',
		'\xc6': 'Ae', '\xe6': 'ae',
		'\xde': 'Th', '\xfe': 'th',
		'\xdf': 'ss',
		// Latin Extended-A block.
		'\u0100': 'A', '\u0102': 'A', '\u0104': 'A',
		'\u0101': 'a', '\u0103': 'a', '\u0105': 'a',
		'\u0106': 'C', '\u0108': 'C', '\u010a': 'C', '\u010c': 'C',
		'\u0107': 'c', '\u0109': 'c', '\u010b': 'c', '\u010d': 'c',
		'\u010e': 'D', '\u0110': 'D', '\u010f': 'd', '\u0111': 'd',
		'\u0112': 'E', '\u0114': 'E', '\u0116': 'E', '\u0118': 'E', '\u011a': 'E',
		'\u0113': 'e', '\u0115': 'e', '\u0117': 'e', '\u0119': 'e', '\u011b': 'e',
		'\u011c': 'G', '\u011e': 'G', '\u0120': 'G', '\u0122': 'G',
		'\u011d': 'g', '\u011f': 'g', '\u0121': 'g', '\u0123': 'g',
		'\u0124': 'H', '\u0126': 'H', '\u0125': 'h', '\u0127': 'h',
		'\u0128': 'I', '\u012a': 'I', '\u012c': 'I', '\u012e': 'I', '\u0130': 'I',
		'\u0129': 'i', '\u012b': 'i', '\u012d': 'i', '\u012f': 'i', '\u0131': 'i',
		'\u0134': 'J', '\u0135': 'j',
		'\u0136': 'K', '\u0137': 'k', '\u0138': 'k',
		'\u0139': 'L', '\u013b': 'L', '\u013d': 'L', '\u013f': 'L', '\u0141': 'L',
		'\u013a': 'l', '\u013c': 'l', '\u013e': 'l', '\u0140': 'l', '\u0142': 'l',
		'\u0143': 'N', '\u0145': 'N', '\u0147': 'N', '\u014a': 'N',
		'\u0144': 'n', '\u0146': 'n', '\u0148': 'n', '\u014b': 'n',
		'\u014c': 'O', '\u014e': 'O', '\u0150': 'O',
		'\u014d': 'o', '\u014f': 'o', '\u0151': 'o',
		'\u0154': 'R', '\u0156': 'R', '\u0158': 'R',
		'\u0155': 'r', '\u0157': 'r', '\u0159': 'r',
		'\u015a': 'S', '\u015c': 'S', '\u015e': 'S', '\u0160': 'S',
		'\u015b': 's', '\u015d': 's', '\u015f': 's', '\u0161': 's',
		'\u0162': 'T', '\u0164': 'T', '\u0166': 'T',
		'\u0163': 't', '\u0165': 't', '\u0167': 't',
		'\u0168': 'U', '\u016a': 'U', '\u016c': 'U', '\u016e': 'U', '\u0170': 'U', '\u0172': 'U',
		'\u0169': 'u', '\u016b': 'u', '\u016d': 'u', '\u016f': 'u', '\u0171': 'u', '\u0173': 'u',
		'\u0174': 'W', '\u0175': 'w',
		'\u0176': 'Y', '\u0177': 'y', '\u0178': 'Y',
		'\u0179': 'Z', '\u017b': 'Z', '\u017d': 'Z',
		'\u017a': 'z', '\u017c': 'z', '\u017e': 'z',
		'\u0132': 'IJ', '\u0133': 'ij',
		'\u0152': 'Oe', '\u0153': 'oe',
		'\u0149': "'n", '\u017f': 'ss'
	};

	function deburrLetter(key) {
		return deburredLetters[key] || key;
	}

	/**
	 * Deburrs `string` by converting
	 * [Latin-1 Supplement](https://en.wikipedia.org/wiki/Latin-1_Supplement_(Unicode_block)#Character_table)
	 * and [Latin Extended-A](https://en.wikipedia.org/wiki/Latin_Extended-A)
	 * letters to basic Latin letters and removing
	 * [combining diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks).
	 *
	 * @static
	 * @memberOf _
	 * @since 3.0.0
	 * @category String
	 * @param {string} [string=''] The string to deburr.
	 * @returns {string} Returns the deburred string.
	 * @example
	 *
	 * _.deburr('déjà vu');
	 * // => 'deja vu'
	 */
	return function deburr(string) {
		return string.replace(reLatin, deburrLetter).replace(reComboMark, '');
	}
})();
