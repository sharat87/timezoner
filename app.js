/*
 * TODO:
 *  Represent day/night for each timezone.
 *  Fuzzy searching of timezones when adding.
 */

const DEFAULT_ZONES = ['Asia/Kolkata', 'America/New_York', 'Europe/Amsterdam'];
const zonesEl = document.getElementById('zones'),
    settingsFormEl = document.forms.settingsForm;

window.addEventListener('load', () => {
    let currentUtc = roundedTo15(moment.utc());
    let currentOffset = 0;
    const midUtc = currentUtc.clone();

    zonesEl.addEventListener('input', onTimeChanged);
    zonesEl.addEventListener('click', onZoneClicked);
    zonesEl.addEventListener('keydown', onZoneKeydown);
    zonesEl.addEventListener('wheel', onZoneWheel);
    document.forms.addZoneForm.addEventListener('submit', onAddFormSubmit);
    settingsFormEl.addEventListener('input', applySettings);

    addZone('UTC');
    for (const name of loadZones())
        addZone(name);

    document.getElementById('loadingBox').remove();
    updateAllZones();
    loadAllTimeZones();
    applySettings();

    function addZone(name) {
        const localClass = moment.tz.guess() === name ? 'local' : '';

        let continent = '', city = name;
        if (name.includes('/'))
            [continent, city] = name.split('/', 2);
        city = city.replace(/_/g, ' ');

        zonesEl.insertAdjacentHTML('beforeEnd', `
            <form class="zone ${localClass}" data-zone="${name}">
                <svg class="dot">
                    <g>
                        <circle r="45%" cx="50%" cy="50%" stroke-width="0"/>
                        <line x1="25%" y1="50%" x2="75%" y2="50%" stroke-width="2" stroke="white" display="none"/>
                    </g>
                </svg>
                <div class=name>
                    <span><span class=continent>${continent}</span><span class=city>${city}</span></span>
                    <span class=tz-abbr></span>
                </div>
                <input class="num" required name="year">
                <span class="sep">&ndash;</span>
                <input class="num" required name="month">
                <span class="sep">&ndash;</span>
                <input class="num" required name="date">
                <span class="sep">&middot;</span>
                <input class="num" required name="hour">
                <span class="sep">:</span>
                <input class="num" required name="minute">
                <span class="sep">&nbsp;</span>
                <input class="num" required name="meridian">
                <!-- <span>&#x1F324;</span> -->
                <!-- <span>&#x1F319;</span> -->
                <div class=slider>
                    <!-- <div class=bg></div> -->
                    <input type="range" min="-2100" max="2100" step=15>
                </div>
            </form>
        `.trim());
        updateZone(zonesEl.lastElementChild);
    }

    function onTimeChanged(event) {
        let target;
        if (event instanceof Event) {
            target = event.target;
        } else if (event instanceof Element) {
            target = event;
            event = null;
        }

        const mt = getMomentInZoneBox(target.closest('.zone'));
        if (target.type === 'range') {
            currentOffset = target.value - mt.utcOffset();
            currentUtc = midUtc.clone().add(currentOffset, 'm');

        } else {
            currentUtc = mt.utc();
            currentOffset = currentUtc.diff(midUtc, 'm');

        }

        updateAllZones({exceptInputs: [target]});
    }

    function updateAllZones(data) {
        const {exceptZone, exceptInputs} = data || {};
        for (const el of zonesEl.children)
            if (el !== exceptZone)
                updateZone(el, exceptInputs);
    }

    function updateZone(zoneEl, exceptInputs) {
        const mt = currentUtc.tz(zoneEl.dataset.zone);
        setMomentInZoneBox(zoneEl, mt, exceptInputs);

        const rangeInput = zoneEl.querySelector('input[type="range"]');
        if (!exceptInputs || !exceptInputs.includes(rangeInput))
            rangeInput.value = currentOffset + mt.utcOffset();
    }

    function onAddFormSubmit(event) {
        event.preventDefault();
        const input = event.target.querySelector('input');
        const name = input.value;
        if (moment.tz.zone(name) === null) {
            input.classList.add('error');
        } else {
            input.classList.remove('error');
            input.value = '';
            addZone(name);
            saveZones();
        }
    }

    function onZoneClicked(event) {
        const dotEl = event.target.closest('.dot');
        if (dotEl) {
            dotEl.closest('.zone').remove();
            saveZones();
        }
    }

    function modifyInput(inputEl, direction) {
        // inputEl should be an input.num element.
        // direction should be -1 or 1.
        const zoneEl = inputEl.closest('.zone');
        const mt = getMomentInZoneBox(zoneEl);
        let unit = inputEl.name;
        let count = 1;

        if (unit === 'meridian')
            [count, unit] = [12, 'h'];
        else if (unit === 'minute')
            count = 15;
        else if (unit === 'date')
            unit = 'd';

        mt.add(direction * count, unit);
        setMomentInZoneBox(zoneEl, roundedTo15(mt));
        onTimeChanged(inputEl);
    }

    function onZoneKeydown(event) {
        if (['ArrowUp', 'ArrowDown'].includes(event.key) && event.target.classList.contains('num')) {
            event.preventDefault();
            modifyInput(event.target, event.key === 'ArrowUp' ? 1 : -1);

        } else if (['ArrowLeft', 'ArrowRight'].includes(event.key) && event.target.classList.contains('num')) {
            const point = event.target.selectionStart;
            if (point === 0 && event.key === 'ArrowLeft') {
                let dst = event.target.previousElementSibling;
                while (!dst.matches('input.num')) {
                    if (dst.previousElementSibling)
                        dst = dst.previousElementSibling;
                    else
                        return;
                }
                dst.focus();
                dst.selectionStart = dst.value.length;
                event.preventDefault();
            } else if (point === event.target.value.length && event.key === 'ArrowRight') {
                let dst = event.target.nextElementSibling;
                while (!dst.matches('input.num')) {
                    if (dst.nextElementSibling)
                        dst = dst.nextElementSibling;
                    else
                        return;
                }
                dst.focus();
                dst.selectionEnd = 0;
                event.preventDefault();
            }

        }
    }

    function onZoneWheel(event) {
        if (event.target.classList.contains('num')) {
            event.preventDefault();
            modifyInput(event.target, -Math.sign(event.deltaY));
        }
    }

    function applySettings() {
        if (settingsFormEl.hideSliders.checked) {
            document.body.classList.add('hide-sliders');
        } else {
            document.body.classList.remove('hide-sliders');
        }
    }

});

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

function getMomentInZoneBox(zoneEl) {
    return moment.tz([
        zoneEl.year.value,
        zoneEl.month.value,
        zoneEl.date.value,
        zoneEl.hour.value,
        zoneEl.minute.value,
        zoneEl.meridian.value,
    ].join(' '), 'YYYY MM DD hh mm A', zoneEl.dataset.zone);
}

function setMomentInZoneBox(zoneEl, mt, exceptInputs) {
    const [year, month, date, hour, minute, meridian, abbr, offset] =
        mt.format('YYYY MM DD hh mm A zz ZZ').split(' ');

    if (!exceptInputs || !exceptInputs.includes(zoneEl.year))
        zoneEl.year.value = year;

    if (!exceptInputs || !exceptInputs.includes(zoneEl.month))
        zoneEl.month.value = month;

    if (!exceptInputs || !exceptInputs.includes(zoneEl.date))
        zoneEl.date.value = date;

    if (!exceptInputs || !exceptInputs.includes(zoneEl.hour))
        zoneEl.hour.value = hour;

    if (!exceptInputs || !exceptInputs.includes(zoneEl.minute))
        zoneEl.minute.value = minute;

    if (!exceptInputs || !exceptInputs.includes(zoneEl.meridian))
        zoneEl.meridian.value = meridian;

    zoneEl.querySelector('.tz-abbr').innerHTML = abbr == zoneEl.dataset.zone ? '' : (abbr + ' = UTC' + offset);
}

function saveZones() {
    const names = [];
    for (const el of zonesEl.children)
        names.push(el.dataset.zone);
    localStorage.setItem('zones', JSON.stringify(names.slice(1)));
}

function loadZones() {
    const storage = localStorage.getItem('zones');
    if (!storage)
        return DEFAULT_ZONES;
    const names = JSON.parse(storage);
    if (!names || names.length === 0)
        return DEFAULT_ZONES;
    return names;
}

function loadAllTimeZones() {
    const names = moment.tz.names();
    for (let i = names.length; i-- > 0;)
        names[i] = '<option value="' + names[i] + '">';
    document.getElementById('zoneNames').innerHTML = names.join('');
}
