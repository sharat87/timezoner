/*
 * TODO:
 *  Slider calculations botch at edges. Make a separate closure for Slider features.
 *  Subtext for each timezone name with offset from UTC.
 *  Represent day/night for each timezone.
 *  Fuzzy searching of timezones when adding.
 */

const DEFAULT_ZONES = ['Asia/Kolkata', 'America/New_York', 'Europe/Amsterdam'];
const zonesEl = document.getElementById('zones');

window.addEventListener('load', () => {
    let currentUtc = roundedTo15(moment.utc());
    const midUtc = currentUtc.clone();

    zonesEl.addEventListener('input', onTimeChanged);
    zonesEl.addEventListener('click', onZoneClicked);
    zonesEl.addEventListener('keydown', onZoneKeydown);
    document.forms.addZoneForm.addEventListener('submit', onAddFormSubmit);

    addZone('UTC');
    for (const name of loadZones())
        addZone(name);

    document.getElementById('loadingBox').remove();
    Slider.calcCurrentHandleX();
    updateAllZones();
    loadAllTimeZones();

    function addZone(name) {
        const localClass = moment.tz.guess() === name ? 'local' : '';
        zonesEl.insertAdjacentHTML('beforeEnd', `
            <form class="zone ${localClass}" data-zone="${name}">
                <svg class="dot">
                    <g>
                        <circle r="45%" cx="50%" cy="50%" stroke-width="0"/>
                        <line x1="25%" y1="50%" x2="75%" y2="50%" stroke-width="2" stroke="white" display="none"/>
                    </g>
                </svg>
                <span class="name">${name}</span>
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
                <svg class="slider" width="100%" height="1.5em">
                    <line x1="2%" y1="50%" x2="98%" y2="50%" stroke-width=".2em" stroke="black" stroke-linecap="round"/>
                    <rect class="handle" width="10" height="100%" fill="#05F" rx="2" ry="2"/>
                </svg>
                <input type="range" min="-100" max="100" style="display: none;">
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

        if (target.classList.contains('handle')) {
            Slider.setCurrentHandleX(parseInt(target.getAttribute('x')));
            Slider.setCurrentOffset(Slider.getCurrentHandleX() - roundedTo15(target.closest('svg').getBBox().width / 2));
            currentUtc = midUtc.clone().add(Slider.getCurrentOffset(), 'm');

        } else {
            currentUtc = getMomentInZoneBox(target.closest('.zone')).utc();
            Slider.setCurrentOffset(currentUtc.diff(midUtc, 'm'));
            Slider.calcCurrentHandleX();

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
        setMomentInZoneBox(zoneEl, mt);

        const rangeInput = zoneEl.querySelector('input[type="range"]');
        if (!exceptInputs || !exceptInputs.includes(rangeInput))
            rangeInput.value = Slider.getCurrentOffset();

        const handle = zoneEl.querySelector('.handle');
        if (!exceptInputs || !exceptInputs.includes(handle))
            handle.setAttribute('x', Slider.getCurrentHandleX());
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

    function onZoneKeydown(event) {
        if (['ArrowUp', 'ArrowDown'].includes(event.key) && event.target.classList.contains('num')) {
            event.preventDefault();
            const zoneEl = event.target.closest('.zone');
            const mt = getMomentInZoneBox(zoneEl);
            let unit = event.target.name;
            let count = 1;

            if (unit === 'meridian') {
                [count, unit] = [12, 'h'];
            } else if (unit === 'minute') {
                count = 15;
            } else if (unit === 'date') {
                unit = 'd';
            }

            mt.add(event.key === 'ArrowUp' ? count : -count, unit);
            setMomentInZoneBox(zoneEl, roundedTo15(mt));
            onTimeChanged(event.target);

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

});

const Slider = (function () {
    let currentHandleX = 0, currentOffset = 0, handleBeingDragged = null;
    let dragStartOffset = 0;
    zonesEl.addEventListener('mousedown', onSliderDragStart);

    function onSliderDragStart(event) {
        if (event.target.classList.contains('handle')) {
            event.preventDefault();
            handleBeingDragged = event.target;
            dragStartOffset = parseInt(event.target.getAttribute('x'), 10) - event.pageX;
            document.addEventListener('mousemove', onSliderDragMove);
            document.addEventListener('mouseup', onSliderDragStop);
        }
    }

    function onSliderDragMove(event) {
        let handleX = dragStartOffset + event.pageX;
        const bBox = handleBeingDragged.closest('svg').getBBox();
        handleX = Math.max(bBox.x + 15, Math.min(bBox.width, handleX));
        handleBeingDragged.setAttribute('x', roundedTo15(handleX));
        handleBeingDragged.dispatchEvent(new CustomEvent('input', {bubbles: true}));
    }

    function onSliderDragStop(event) {
        document.removeEventListener('mousemove', onSliderDragMove);
        document.removeEventListener('mouseup', onSliderDragStop);
        handleBeingDragged = null;
    }

    const slider = {
        getCurrentHandleX() {
            return currentHandleX;
        },

        setCurrentHandleX(val) {
            currentHandleX = val;
        },

        getCurrentOffset() {
            return currentOffset;
        },

        setCurrentOffset(val) {
            currentOffset = val;
        },

        calcCurrentHandleX() {
            slider.setCurrentHandleX(roundedTo15(currentOffset + zonesEl.querySelector('svg.slider').getBBox().width / 2));
        },
    };

    return slider;
}());

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

function setMomentInZoneBox(zoneEl, mt) {
    [
        zoneEl.year.value,
        zoneEl.month.value,
        zoneEl.date.value,
        zoneEl.hour.value,
        zoneEl.minute.value,
        zoneEl.meridian.value,
    ] = mt.format('YYYY MM DD hh mm A').split(' ');
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
