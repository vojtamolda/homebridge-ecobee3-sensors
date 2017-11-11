/* jshint esversion: 6 */

var Accessory, Service, Characteristic;
var Chalk = require('chalk');

module.exports = function (accessory, service, characteristic) {
  Accessory = accessory;
  Service = service;
  Characteristic = characteristic;

  return EcobeeSensor;
};


function EcobeeSensor(log, config, platform, homebridgeAccessory) {
  this.log = log;
  this.name = config.name;
  this.prefix = Chalk.blue("[" + config.name + "]");
  this.log.debug(this.prefix, "Initializing sensor...");
  this.log.debug(config);

  this.homebridgeAccessory = homebridgeAccessory;
  this.homebridgeAccessory.on('identify', this.identify.bind(this));

  var informationService = this.homebridgeAccessory.getService(Service.AccessoryInformation);
  informationService.getCharacteristic(Characteristic.Name).setValue(config.name);
  informationService.getCharacteristic(Characteristic.Manufacturer).setValue("ecobee Inc.");
  informationService.getCharacteristic(Characteristic.Model).setValue("ecobee3 sensor");
  informationService.getCharacteristic(Characteristic.SerialNumber).setValue(config.code);

  var temperatureService = null, occupancyService = null, humidityService = null;
  for (var capability of config.capability) {
    switch (capability.type) {

      case 'temperature':
        if (platform.excludeTemperatureSensors) continue;
        temperatureService = this.homebridgeAccessory.getService(Service.TemperatureSensor);
        if (!temperatureService) {
          temperatureService = this.homebridgeAccessory.addService(Service.TemperatureSensor);
          temperatureService.displayName = "Temperature";
        }
        this.temperatureCharacteristic = temperatureService.getCharacteristic(Characteristic.CurrentTemperature);
        this.temperatureActiveCharacteristic = temperatureService.getCharacteristic(Characteristic.StatusActive);
        break;

      case 'occupancy':
        if (platform.excludeOccupancySensors) continue;
        occupancyService = this.homebridgeAccessory.getService(Service.OccupancySensor);
        if (!occupancyService) {
          occupancyService = this.homebridgeAccessory.addService(Service.OccupancySensor);
          occupancyService.displayName = "Occupancy";
        }
        this.occupancyCharacteristic = occupancyService.getCharacteristic(Characteristic.OccupancyDetected);
        break;

      case 'humidity':
        if (platform.excludeHumiditySensors) continue;
        humidityService = this.homebridgeAccessory.getService(Service.HumiditySensor);
        if (!humidityService) {
          humidityService = this.homebridgeAccessory.addService(Service.HumiditySensor);
          humidityService.displayName = "Humidity";
        }
        this.humidityCharacteristic = humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity);
        break;

      default:
        this.log.error(this.prefix, "Not-supported measurement type | " + capability.type);
        break;
    }
  }

  this.log.info(this.prefix, "Initialized | " + config.code);
  this.update(config);
}


EcobeeSensor.prototype.update = function (config) {
  this.log.debug(this.prefix, "Updating sensor measurement...");
  this.log.debug(config);
  var temperature = null, occupancy = null, humidity = null; var output = [];
  for (var capability of config.capability) {
    switch (capability.type) {

      case 'temperature':
        if (!this.temperatureCharacteristic) continue;
        temperature = f2c(capability.value);
        this.temperatureCharacteristic.updateValue(temperature, null, this);
        this.temperatureActiveCharacteristic.updateValue(config.inUse, null, this);
        output.push(temperature.toFixed(1) + "°C");
        break;

      case 'occupancy':
        if (!this.occupancyCharacteristic) continue;
        occupancy = t2b(capability.value);
        this.occupancyCharacteristic.updateValue(occupancy, null, this);
        output.push((occupancy) ? "Occupied" : "Vacant");
        break;

      case 'humidity':
        if (!this.humidityCharacteristic) continue;
        humidity = t2p(capability.value);
        this.humidityCharacteristic.updateValue(humidity, null, this);
        output.push(humidity + "%");
        break;

      default:
        break;
    }
  }
  this.log.info(this.prefix, output.join(" | "));
};


EcobeeSensor.prototype.identify = function (callback) {
  this.log.info(this.prefix, "Identify");
  if (callback) callback();
};


function f2c(fahrenheit10x) {
  var celsius = (parseInt(fahrenheit10x, 10) - 320) * 5 / 90;
  return celsius;
}

function t2b(text) {
  var boolean = (text.toLowerCase() === 'true');
  return boolean;
}

function t2p(text) {
  var percent = parseInt(text, 10);
  return percent;
}
