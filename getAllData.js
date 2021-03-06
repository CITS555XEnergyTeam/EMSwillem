import {
    range
} from 'd3';




/**
 * Round a number
 * @param {*} x - number to be rounded
 * @param {*} n - number of decimal places to round by
 * @returns - rounded numebr
 */
const round = (x, n) => {
    return Math.round(x * 10 ** n) / 10 ** n;
}

/**
 * Map a naive key to the keys used by the UI if possible
 * @param {*} a - System - String
 * @param {*} b - Attriubte -String
 * @param {*} c  - Unit - String
 * @returns key as String
 */
const createKey = (a, b, c) => {
    const dbName = c + " " + b + " " + a
    const dbNames = ["EZONE Solar Meter Power", "EZONE Simulated Wind Power", "EV Car Charge Power", "EZONE Power Consumption Power", "EZONE Weather Station Radiation", "EZONE Weather Station Speed","EZONE Weather Station Density"]
    const displayNames = ["Solar Panels", "Wind Turbine", "DC Charger", "Consumption", "Solar Irradiance", "Wind Speed", "Air Density"];
    const i = dbNames.indexOf(dbName)
    return i >= 0 ? displayNames[i] : dbName;
}



const mockRadiation = (d, t) => {
    const dailyRadiation = d
    const output = (0.5 + Math.random()) / (288 / dailyRadiation) * (-1 * (t - 5) * (t - 17))
    //quadratic Model
    return Math.max(output, 0)
}
const mockSolar = (r, a = 40) => {
    const performance = 0.75 * 0.15 * a//Area*PerformanceRatio*Yeild
    return r * performance
}
const mockWindSpeed = (t) => {
    const maxi = 15
    return maxi + maxi * Math.sin(t + Math.random())
}

const mockWind = (w) => {
    const sweptArea = 1 * 1.5 * 5
    return 0.3 * 0.5 * w ** 3 * sweptArea /1000
}

const mockConsumption = (t) => {
    const tn = t + 4 * Math.random() - 2
    const m = 2
    const s = 5
    return 50 * Math.exp(-0.5 * ((tn - m) / s) ** 2) + 1

}

const mockDC = (t) => {
    if (t == 8 || t == 10 || t == 6) {
        return 50 + 10 * Math.random()
    } else {
        return 0
    }
}
const mockEZONE = (v, r, d, c) => {
    const w = round(mockWind(v, 1.2), 1)
    const s = round(mockSolar(r), 1)
    let b = 0
    //If the Battery needs to help
    b = round(c + d - s - w, 1)
    if (b > 0) {
        b = Math.min(b, 5)
        //If the Battery can charge
    }
    const g = round(-w - s + c + dc - b, 1)
    return [r, s, v, w, b, -dc, -c, g]

}


const mockUsage = (d, t) => {
    const v = round(mockWindSpeed(t), 1)
    const w = round(mockWind(v, 1.2), 1)

    const r = round(mockRadiation(d, t), 1)
    const s = round(mockSolar(r), 1)

    const c = round(mockConsumption(t), 1)
    const dc = round(mockDC(t), 1)

    let b = 0
    //If the Battery needs to help
    b = round(c + dc - s - w, 1)
    if (b > 0) {
        b = Math.min(b, 5)
        //If the Battery can charge
    }
    const g = round(-w - s + c + dc - b, 1)
    return [r, s, v, w, b, -dc, -c, g]
}

const mockTimeStamps = (start, step, n) => {
    let times = []
    range(start, start - n, -step).forEach(t => {
        times.push(new Date(t))
    })
    return times
}

export const generateData = () => {
    /** Class representing one type of data to be visulaized */
    class Device {
        /**
        * Create an expandable data series 
        * @param {string} attribute_name - attribute the object is describing (the thing being measured)
        * @param {string} device_name - device the object is describing (the logical group the measurement comes from)
        * @param {string} pvsystem - system the object is describing (the physical building or unit the measurement comes from)
        * @param {string} unit - unit of measurement used by the attribute 
        * @param {string} timestamp - timestamp: the datapoint which creates this object will have a timestamp and value that need to be stored by the device
        * @param {number} value - value: the datapoint which creates this object will have a timestamp and value that need to be stored by the device
        */
        constructor(attribute_name, device_name, pvsystem, unit) {
            this.attribute_name = attribute_name;
            this.device_name = device_name;
            this.pvsystem = pvsystem;
            this.unit = unit;
            this.datapoints = new Map;
            this.range = { "min": 99999, "max": 0 }
            /**
             * expand the data series by pushing onto this object's timestamp and value arrays
             * @param {string} timestamp 
             * @param {number} value 
             */
            this.addData = function (timestamp, value) {
                const key = new Date(timestamp)
                this.datapoints.set(key.getTime(), value);
                if (value > this.range.max) this.range.max = value
                if (value < this.range.min) this.range.min = value
            };
            this.setXY = function (min, max) {
                this.range.min = min;
                this.range.max = max;
            }
        }

    }
    /** Class representing the data to be visualized */
    class DataStore {
        constructor() {
            this.devices = new Map;
            /**
            * Given the object whose key is given by (attr,dev,sys) store the t,v pair in that object.
            * @param {string} attr - attribute the object is describing (the thing being measured)
            * @param {string} dev - device the object is describing (the logical group the measurement comes from)
            * @param {string} sys - system the object is describing (the physical building or unit the measurement comes from)
            * @param {string} unit - unit of measurement used by the attribute 
            * @param {string} t - timestamp: the datapoint which creates this object will have a timestamp and value that need to be stored by the device
            * @param {number} v - value: the datapoint which creates this object will have a timestamp and value that need to be stored by the device
            */
            this.newDatapoint = function (attr, dev, sys, t, v) {
                const key = createKey(attr, dev, sys);
                //search devices for the correct device
                if (this.devices.has(key)){
                    this.devices.get(key).addData(t, v);}
            };
            /**
            * Does this datastore object already contain the object desrcibed by these arguments?
            * Note that these arguments must always form a key for device objects
            * @param {string} attr - attribute the object is describing (the thing being measured)
            * @param {string} dev - device the object is describing (the logical group the measurement comes from)
            * @param {string} sys - system the object is describing (the physical building or unit the measurement comes from)
            * @returns {Boolean} - does the key already exist in the device list
            */
            this.has = function (attr, dev, sys) {
                return this.devices.has(createKey(attr,dev,sys));
            };
            /**
            * Add a measurement object to the datastore object's device array
            * @param {string} attr - attribute the object is describing (the thing being measured)
            * @param {string} dev - device the object is describing (the logical group the measurement comes from)
            * @param {string} sys - system the object is describing (the physical building or unit the measurement comes from)
            * @param {string} unit - unit of measurement used by the attribute 
            * @param {string} t - timestamp: the datapoint which creates this object will have a timestamp and value that need to be stored by the device
            * @param {number} v - value: the datapoint which creates this object will have a timestamp and value that need to be stored by the device
            */
            this.newDevice = function (attr, dev, sys, unit, t, v) {
                const key = createKey(attr, dev, sys);
                this.devices.set(key, new Device(attr, dev, sys, unit));
                this.devices.get(key).addData(t, v);
            };

            this.getPowerDevices = function () {
                const dPower = Array.from(this.devices.values()).filter(d => { d.unit == "kW" || d.attribute_name == "Power" });
                return dPower.map(d => { createKey(d.attribute_name, d.device_name, d.pvsystem); });
            }

            /**
            * Simulate a new measurement object from existing data and  store in the datastore object's device array
            * @param {string} attr - attribute the object is describing (the thing being measured)
            * @param {string} dev - device the object is describing (the logical group the measurement comes from)
            * @param {string} sys - system the object is describing (the physical building or unit the measurement comes from)
            * @param {string} unit - unit of measurement used by the attribute 
            * @param {string} source - The attr used as input to simulate the new data, this attr's timestamps are used for the new data.
            * @param {func} func - the function used to simulate the new data 
            */
            this.simulateDevice = function (deviceProps, func, ...args) {
                const [attr, dev, sys, unit] = deviceProps
                let max = 0, min = 99999;
                let d1 = this.devices.get(args[0]);
                let d2 = new Device(attr, dev, sys, unit);
                let dn = new Array(0);
                args.forEach(k => {
                    dn.push(this.devices.get(k));
                })
                //for each timestamp
                const keys = d1.datapoints.keys()
                let k = keys.next();
                while(!k.done){
                    let valid = true;
                    let dnValues = [];
                    //for each device
                    dn.forEach(d => {
                        //if this device has this timestamp
                        if (d.datapoints.has(k.value)) {
                            dnValues.push(d.datapoints.get(k.value));
                        } else {
                            valid = false;
                        }
                    })
                    if(valid){
                        const vNew = func(dnValues)
                        d2.addData(k.value, vNew)
                        max = Math.max(max, vNew);
                        min = Math.min(min, vNew);
                    }
                    k = keys.next();
            }
                const kNew = createKey(attr, dev, sys);
                this.devices.set(kNew , d2);
                this.devices.get(kNew ).setXY(min, max);
                
            }

            this.exportData = function () {

                return this.devices;


            }
        }
    }




    /**
     * Take data and store or creat create device object if needed
     */
    const proccessDatapoint = (attr, dev, sys, unit, t, v) => {
        //Fix unit error in data
        let vScale = sys=="EV"?v/1000:v
        if (dataStore.has(attr, dev, sys)) {
            //if an object already exists add a data point to it
            dataStore.newDatapoint(attr, dev, sys, t, vScale)
        } else {
            //Otherwise create the object
            dataStore.newDevice(attr, dev, sys, unit, t, vScale)
        }
    }




    let dataStore = new DataStore();

    //Parse data
    const dataMonth = Object.values(require('./one_month.json').testData);
    dataMonth.forEach(d => {
        proccessDatapoint(d.attribute_name, d.device_name, d.pvsystem, d.unit, d.timestamp, Number(d.value));
    })
    //Simualte VAWT data
    const windSim = ["Power", "Simulated Wind", "EZONE", "kW"]
    const windKey = createKey("Speed", "Weather Station", "EZONE")
    dataStore.simulateDevice(windSim, mockWind, windKey)

    return dataStore
}
