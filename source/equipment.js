/* jshint esversion: 6 */

var Accessory, Service, Characteristic;
var Chalk = require('chalk');

module.exports = function (accessory, service, characteristic) {
  Accessory = accessory;
  Service = service;
  Characteristic = characteristic;

  return EcobeeEquipment;
};


function EcobeeEquipment(log, config, platform, homebridgeAccessory) {
  this.log = log;
  this.name = config.name;
  this.prefix = Chalk.blue("[" + config.name + "]");
  this.log.debug(this.prefix, "Initializing equipment...");
  this.log.debug(config);

  this.homebridgeAccessory = homebridgeAccessory;
  this.homebridgeAccessory.on('identify', this.identify.bind(this));

  var informationService = this.homebridgeAccessory.getService(Service.AccessoryInformation);
  informationService.getCharacteristic(Characteristic.Name).setValue(config.name);
  informationService.getCharacteristic(Characteristic.Manufacturer).setValue("ecobee Inc.");
  informationService.getCharacteristic(Characteristic.Model).setValue("ecobee3 equipment");
  informationService.getCharacteristic(Characteristic.SerialNumber).setValue('ecobee3-equipment-' + config.name);

  if (platform.excludeEquipmentSensors) return;
  var switchService = this.homebridgeAccessory.getService(Service.ContactSensor);
  this.temperatureCharacteristic = switchService.getCharacteristic(Characteristic.ContactSensorState);

  this.log.info(this.prefix, "Initialized | " + config.name);
  this.update(config);
}


EcobeeEquipment.prototype.update = function (status) {
  this.log.debug(this.prefix, "Updating equipment measurement...");
  this.log.debug(config);

  if (this.temperatureCharacteristic) {
    var currentValue = status ?
      this.Characteristic.ContactSensorState.CONTACT_DETECTED :
      this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;

    this.temperatureCharacteristic.setValue(currentValue);
    this.log.info(this.prefix, this.currentValue);
  }
};


EcobeeEquipment.prototype.identify = function (callback) {
  this.log.info(this.prefix, "Identify");
  if (callback) callback();
};