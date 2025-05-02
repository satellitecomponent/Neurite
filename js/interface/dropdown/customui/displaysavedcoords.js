globalThis.Location = class {
    constructor(title, zoom, panReal, panImagin){
        this.panImaginary = (isNaN(panImagin) ? 0 : parseFloat(panImagin));
        this.panReal = (isNaN(panReal) ? 0 : parseFloat(panReal));
        this.title = String(title);
        this.zoom = (isNaN(zoom) ? 1 : parseFloat(zoom));
    }
    get pan(){ return this.panReal + "+i" + this.panImaginary }
    static byPan(title, zoom, pan){
        const panParts = pan.split('+i');
        return new Location('// ' + title, zoom, panParts[0], panParts[1]);
    }
}

// https://www.mrob.com/pub/muency/colloquialnames.html
const dfltLocations = {
    "mandelbrot": [
        Location.byPan("Seahorse Valley West", 0.0000017699931315047657,
                            "-0.7677840466850392+i-0.10807751495298584"),
        Location.byPan("Double Scepter Valley", 0.000017687394673278873,
                            "-0.13115417841259247+i-0.8429048341831951"),
        Location.byPan("Quad Spiral Valley", 6.622764227402511e-7,
                            "0.35871212237104466+i0.614868924400545"),
        Location.byPan("North Radical", 0.01666349480736333,
                            "-0.17757277666659035+i-1.0860005295937438"),
        Location.byPan("Shepherds Crook", 0.000029460494639545112,
                            "-0.7450088997859019+i-0.11300333384642439"),
        Location.byPan("South Radical", 0.022493365230716315,
                            "-0.17709676066268798+i1.0856909324960642"),
        Location.byPan("Triple Spiral Valley", 0.0002361832763705042,
                            "-0.15629012673807463+i0.6534879139112698")
    ],
    "burningShip": [
        Location.byPan("East Spoke", 8.420214425120169e-2,
                            "9.169164222633116e-1+i-1.6310643190278835e+0"),
        Location.byPan("West Spoke", 1.8788037931611875e-2,
                            "-1.9711042552803943e+0+i-4.334808282086102e-3"),
        Location.byPan("Kansas", 1.546207997245595e-4,
                            "-2.9164166060085045e-1+i1.306446844207734e-1"),
        Location.byPan("Cathedral Valley", 1.434728547873302e-6,
                            "-1.7964026403617497e+0+i-6.890731439710235e-7"),
        Location.byPan("Dumpster-Fire", 5.920320423831963e-5,
                            "-1.5078232909808023e+0+i-3.55694616402374e-5"),
        Location.byPan("Iris Chasm", 7.698116326980893e-6,
                            "-1.5075332685770135e+0+i4.3338695907954664e-4"),
        Location.byPan("Archipelago", 9.354013289992328e-4,
                            "-7.008855604508728e-1+i-1.0783378699218966e+0")
    ],
    "julia": [
        Location.byPan("South Spiral", 7.638646189048822e-3,
                            "4.7332900084640715e-2+i8.993463379974346e-1"),
        Location.byPan("North Spiral", 1.3918520830597225e-2,
                            "-3.6849331744016355e-2+i-9.029969059101963e-1"),
        Location.byPan("East Spiral", 3.859876908954036e-2,
                            "5.589693781322422e-1+i-8.304609304546705e-2"),
        Location.byPan("West Spiral", 9.71062247743426e-3,
                            "-5.546948889347452e-1+i9.444801375262804e-2")
    ],
    "tricorn": [
        // Add default Tricorn locations
    ],
    "buffalo": [
        // Add default Buffalo locations
    ],
    "henon": [
        // Add default Henon locations
    ],
    "ikeda": [
        // Add default Ikeda locations
    ],
    "all": [ Location.byPan("Reset Coords", 1, "0+i0") ]
};

Manager.Locations = class {
    #dict = {};
    #stored = new Stored('locations');

    add(location, fractal = settings.fractal){
        (this.#dict[fractal] ||= []).push(location);
        Logger.info("Location saved:", location);
        return this.save();
    }

    deleteAtIndex(index, fractal = settings.fractal){
        const items = this.#dict[fractal];
        const location = items[index];
        items.splice(index, 1);
        Logger.info("Location deleted:", location);
        return this.save();
    }
    get(fractal = settings.fractal){
        return (fractal ? this.#dict[fractal] || [] : this.#dict)
    }
    getByIndex(index, fractal = settings.fractal){
        return this.#dict[fractal][index]
    }

    load(){ return this.#stored.load().then(this.#handleDict) }
    #handleDict = (dict)=>{ this.#dict = dict ?? { ...dfltLocations } }

    save(){ return this.#stored.save(this.#dict) }
    setDict(dict){ this.#dict = dict }
}

View.Locations = class {
    #btnDelete = new View.Locations.DeleteButton(this.#deleteSelected, this);
    #btnSave = new View.Locations.SaveButton(this.#saveLocation, this);
    model = new Manager.Locations();
    #selected = new View.Locations.Selected(this.#updateBtnDelete, this);
    #viewList = new View.Locations.ListView(this);

    init(){ this.model.load().then(this.#initChildren.bind(this)) }
    #initChildren(){
        this.#btnSave.init();
        this.#viewList.init();
    }

    deselect(){ this.#selected.set(null) }
    setDict(dict){
        this.model.setDict(dict);
        this.model.save();
        this.#viewList.update();
    }

    static DeleteButton = class {
        #btn = Elem.byId('btnDeleteLocation');
        constructor(cb, ct){ this.cb = cb; this.ct = ct }
        update(location){
            (location ? On : Off).click(this.#btn, this.#onClicked);
            this.#btn.style.opacity = (location ? '' : '0.25');
        }

        #onClicked = (e)=>{
            window.confirm("Surely delete this location from the list?")
            .then(this.#handleConfirmDeletetion)
        }
        #handleConfirmDeletetion = (confirmed)=>{
            if (!confirmed) return;

            this.cb.call(this.ct);
            this.#btn.textContent = "Deleted!";
            Promise.delay(1000).then(this.#restore);
        }
        #restore = ()=>{ this.#btn.textContent = "Delete Location" } ;
    }
    #deleteSelected(){
        this.model.deleteAtIndex(this.#selected.key);
        this.deselect();
        this.#viewList.update();
    }

    static SaveButton = class {
        #btn = Elem.byId('btnSaveLocation');
        constructor(cb, ct){ this.cb = cb; this.ct = ct }
        init(){ On.click(this.#btn, this.#onClicked) }

        #onClicked = (e)=>{
            window.prompt("Enter a title for the current location:")
            .then(this.#onTitle, this.#onError)
            .then(this.#handleLocation)
        }
        #onTitle = (title)=>(title && Graph.getCoords(title)) ;
        #onError = Logger.err.bind(Logger, "Failed to get prompt input:");
        #handleLocation = (location)=>{
            if (!location) {
                return Logger.info("Location save cancelled by user.")
            }

            this.cb.call(this.ct, location);
            this.#btn.textContent = "Saved!";
            Promise.delay(1000).then(this.#restore);
        }
        #restore = ()=>{ this.#btn.textContent = "Save Location" } ;
    }
    #saveLocation(location){
        this.model.add(location);
        this.#selected.set(null, location);
        this.#viewList.update();
    }

    static Selected = class {
        #elem = null;
        #model = null;
        constructor(cb, ct){ this.cb = cb; this.ct = ct }

        get key(){ return this.#elem.dataset.key }
        maySet(elem, model){ if (model === this.#model) this.set(elem, model) }
        set(elem, model){
            if (this.#elem) {
                this.#elem.classList.remove('selected-coordinate');
                this.#elem.style.transform = '';
            }
            if (elem) {
                elem.classList.add('selected-coordinate');
                elem.style.transform = 'scale(0.95)'; // Scale down for selected
            }
            this.#elem = elem;
            this.#model = model;
            this.cb.call(this.ct, model);
        }
    }
    #updateBtnDelete(location){ this.#btnDelete.update(location) }

    static ListView = class ListView {
        #containerBottom = Elem.byId('savedCoordinatesContainerBottom');
        #containerMain = Elem.byId('savedCoordinatesContainer');
        #containerTop = Elem.byId('savedCoordinatesContainerTop');
        constructor(mom){
            this.divMaker = new ListView.DivMaker(mom);
            this.mom = mom;
        }
        init(){
            settings.onChange('fractal', this.update, this);
            this.update();
        }

        #distributeItems(items){
            const mainCount = Math.round(items.length * 0.50); // 50% for main
            const topCount = Math.round(items.length * 0.32); // 32% for top
            // For the bottom, we use the remaining items
            const bottomCount = items.length - mainCount - topCount; // 15% for bottom

            return {
                main: items.slice(0, mainCount),
                top: items.slice(mainCount, mainCount + topCount),
                bottom: items.slice(mainCount + topCount)
            };
        }

        static DivMaker = class {
            fractal = 'all';
            constructor(grandma){ this.grandma = grandma }
            makeDivs(locations, fractal){
                this.fractal = fractal;
                return locations.map(this.makeDiv, this);
            }

            makeDiv(location, index){
                const div = Html.make.div('saved-coordinate-item');
                div.textContent = location.title;
                div.dataset.fractal = this.fractal;
                div.dataset.key = index;

                On.click(div, this.#onClicked);
                this.grandma.#selected.maySet(div, location);
                return div;
            }
            #onClicked = (e)=>{
                const div = e.currentTarget;
                const fractal = div.dataset.fractal;
                const key = div.dataset.key;
                const location = this.grandma.model.getByIndex(key, fractal);
                Animation.goToLocation(location);

                this.grandma.#selected.set(div, location);
                On.mouseleave(div, this.#resetTransform);
            }
            #resetTransform(e){ e.currentTarget.style.transform = '' }
        }

        update(){
            const model = this.mom.model;
            const divMaker = this.divMaker;
            const curDivs = divMaker.makeDivs(model.get(), settings.fractal);
            const allDivs = divMaker.makeDivs(model.get('all'), 'all');
            const combinedDivs = [...curDivs, ...allDivs];
            const distribution = this.#distributeItems(combinedDivs);

            this.#containerBottom.innerHTML = '';
            this.#containerMain.innerHTML = '';
            this.#containerTop.innerHTML = '';
            this.#containerBottom.append(...distribution.bottom);
            this.#containerMain.append(...distribution.main);
            this.#containerTop.append(...distribution.top);
        }
    }
}
