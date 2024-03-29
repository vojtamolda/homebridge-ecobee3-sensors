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
  this.isEquipment = true;
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

  var service = this.homebridgeAccessory.getService(Service.ContactSensor);
  if (!service) {
    service = this.homebridgeAccessory.addService(Service.ContactSensor);
    service.displayName = 'Equipment';
  }
  this.switchState = service.getCharacteristic(Characteristic.ContactSensorState);

  this.log.info(this.prefix, "Initialized | " + config.name);
  this.update(true);
}


EcobeeEquipment.prototype.update = function (status) {
  this.log.debug(this.prefix, "Updating equipment measurement " + this.name);

  if (this.switchState) {
    var currentValue = status ?
      Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
      Characteristic.ContactSensorState.CONTACT_DETECTED;
    this.switchState.setValue(currentValue);
    this.log.info(this.prefix + " - " + status);
  }
};


EcobeeEquipment.prototype.identify = function (callback) {
  this.log.info(this.prefix, "Identify");
  if (callback) callback();
};
